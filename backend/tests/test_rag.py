from backend.app.rag.vectorstore import EmbeddingGenerator

def test_embedding_generator_fallback():
    # Test fallback vector generation
    generator = EmbeddingGenerator(provider="local")
    embeddings = generator.generate_embeddings(["Scientific query sample.", "Another test text."])
    
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 384  # MiniLM dimension
    
    # Test that vector is normalized (sum of squares close to 1)
    norm = sum(x*x for x in embeddings[0])
    assert abs(norm - 1.0) < 0.1
