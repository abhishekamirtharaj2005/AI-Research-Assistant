import chromadb
import re
import os
import requests
from typing import List, Dict, Any, Optional
from backend.app.config import settings
from backend.app.models.schemas import UserSetting
from backend.app.rag.agents import extract_provider_key

class EmbeddingGenerator:
    """
    Generates embeddings using the configured provider:
    - openai (text-embedding-3-small)
    - gemini (text-embedding-004)
    - ollama (nomic-embed-text or model specified)
    - local (fallback simple vector representation or sentence-transformers if installed)
    """
    def __init__(self, provider: str = "openai", model_name: str = "text-embedding-3-small", api_key: str = "", ollama_url: str = ""):
        self.provider = provider
        self.model_name = model_name
        self.api_key = api_key
        self.ollama_url = ollama_url or settings.OLLAMA_BASE_URL
        
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
            
        # 1. OpenAI Provider
        if self.provider == "openai" and self.api_key:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=self.api_key)
                response = client.embeddings.create(
                    input=texts,
                    model=self.model_name or "text-embedding-3-small"
                )
                return [data.embedding for data in response.data]
            except Exception as e:
                print(f"OpenAI embedding error: {e}. Falling back to local.")
                
        # 2. Gemini Provider
        elif self.provider == "gemini" and self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                embeddings = []
                for text in texts:
                    result = genai.embed_content(
                        model="models/text-embedding-004",
                        content=text,
                        task_type="retrieval_document"
                    )
                    embeddings.append(result["embedding"])
                return embeddings
            except Exception as e:
                print(f"Gemini embedding error: {e}. Falling back to local.")
                
        # 3. Ollama Provider
        elif self.provider == "ollama":
            try:
                # Default ollama embedding model is nomic-embed-text
                embeddings = []
                for text in texts:
                    res = requests.post(
                        f"{self.ollama_url}/api/embeddings",
                        json={"model": self.model_name or "nomic-embed-text", "prompt": text},
                        timeout=10
                    )
                    if res.status_code == 200:
                        embeddings.append(res.json()["embedding"])
                    else:
                        raise ValueError(f"Ollama returned status {res.status_code}")
                return embeddings
            except Exception as e:
                print(f"Ollama embedding error: {e}. Falling back to local.")
                
        # 4. Fallback: Local SentenceTransformers (if installed) or basic TF-IDF mock
        try:
            from sentence_transformers import SentenceTransformer
            # Lightweight, fast model
            model = SentenceTransformer("all-MiniLM-L6-v2")
            vectors = model.encode(texts)
            return [v.tolist() for v in vectors]
        except Exception as e:
            # Absolute fallback: Generate a basic pseudo-semantic vector based on word hash
            # 384 dimensions to match MiniLM
            print(f"SentenceTransformers fallback unavailable: {e}. Using hash fallback.")
            fallback_vectors = []
            for text in texts:
                vector = [0.0] * 384
                words = re.findall(r"\w+", text.lower())
                if words:
                    for i, word in enumerate(words):
                        # simple hash mapping to dimension
                        dim = hash(word) % 384
                        vector[dim] += 1.0
                    # Normalize
                    norm = sum(x*x for x in vector) ** 0.5
                    if norm > 0:
                        vector = [x / norm for x in vector]
                fallback_vectors.append(vector)
            return fallback_vectors

def chunk_text_by_pages(pages: List[Dict[str, Any]], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Split document text page by page.
    This ensures that each chunk maps perfectly to a single page number for citation precision.
    """
    chunks = []
    chunk_index_global = 0
    
    for page in pages:
        page_num = page["page_number"]
        text = page["text"]
        
        # Clean up whitespace
        text = re.sub(r"\s+", " ", text).strip()
        
        if not text:
            continue
            
        # Recursive-like character chunker bounded by page
        start = 0
        while start < len(text):
            end = start + chunk_size
            if end >= len(text):
                chunk_text = text[start:]
                start = len(text)
            else:
                # Find nearest space to prevent splitting words
                space_idx = text.rfind(" ", start, end)
                if space_idx > start + chunk_size // 2:
                    end = space_idx
                chunk_text = text[start:end]
                start = end - chunk_overlap
                
            chunks.append({
                "page_number": page_num,
                "chunk_index": chunk_index_global,
                "content": chunk_text
            })
            chunk_index_global += 1
            
    return chunks

class ChromaVectorStore:
    def __init__(self):
        # Persistent Client
        self.client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
        
    def _get_collection(self, user_id: int):
        # Separate collections per user for security & search speed
        collection_name = f"user_{user_id}_papers"
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
    def add_paper_chunks(self, user_id: int, paper_id: int, paper_title: str, chunks: List[Dict[str, Any]], settings_obj: UserSetting):
        collection = self._get_collection(user_id)
        
        texts = [c["content"] for c in chunks]
        ids = [f"paper_{paper_id}_chunk_{c['chunk_index']}" for c in chunks]
        metadatas = [{
            "paper_id": paper_id,
            "paper_title": paper_title,
            "page_number": c["page_number"],
            "chunk_index": c["chunk_index"]
        } for c in chunks]
        
        # Generate embeddings
        provider = settings_obj.model_provider if settings_obj else "openai"
        api_key = extract_provider_key(settings_obj, provider)
            
        embedder = EmbeddingGenerator(
            provider=provider,
            model_name="text-embedding-3-small" if provider == "openai" else None,
            api_key=api_key,
            ollama_url=api_key if (api_key and api_key.startswith("http")) else ""
        )
        embeddings = embedder.generate_embeddings(texts)
        
        collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=texts
        )
        
    def delete_paper_chunks(self, user_id: int, paper_id: int):
        collection = self._get_collection(user_id)
        # Delete by metadata filter
        collection.delete(
            where={"paper_id": paper_id}
        )
        
    def search_similar_chunks(self, user_id: int, query: str, settings_obj: UserSetting, limit: int = 5, paper_ids: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        collection = self._get_collection(user_id)
        
        # Generate query embedding
        provider = settings_obj.model_provider if settings_obj else "openai"
        api_key = extract_provider_key(settings_obj, provider)
            
        embedder = EmbeddingGenerator(
            provider=provider,
            api_key=api_key,
            ollama_url=api_key if (api_key and api_key.startswith("http")) else ""
        )
        query_embedding = embedder.generate_embeddings([query])[0]
        
        # Build filter if specific paper_ids are queried
        where_filter = None
        if paper_ids:
            if len(paper_ids) == 1:
                where_filter = {"paper_id": paper_ids[0]}
            else:
                where_filter = {"$or": [{"paper_id": pid} for pid in paper_ids]}
                
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where_filter
        )
        
        parsed_results = []
        if results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)
            ids = results["ids"][0]
            
            for i in range(len(docs)):
                # Chroma cosine distance is typically 1 - cosine_similarity. So cosine_similarity = 1 - distance
                similarity = 1.0 - distances[i] if distances[i] is not None else 0.0
                confidence = max(0.0, min(1.0, similarity)) # bounds [0, 1]
                
                parsed_results.append({
                    "id": ids[i],
                    "content": docs[i],
                    "metadata": metas[i],
                    "similarity": similarity,
                    "confidence": confidence
                })
        
        return parsed_results
