import fitz  # PyMuPDF
import pdfplumber
import re
import os
from typing import Dict, List, Any, Optional

def extract_pdf_data(file_path: str) -> Dict[str, Any]:
    """
    Extracts text by pages, parses metadata, and identifies components like:
    - Title
    - Authors
    - Abstract
    - References
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    doc_fitz = fitz.open(file_path)
    pages = []
    full_text = ""
    
    # 1. Extract raw text by page
    for page_idx, page in enumerate(doc_fitz):
        text = page.get_text("text")
        pages.append({
            "page_number": page_idx + 1,
            "text": text
        })
        full_text += f"\n--- PAGE {page_idx + 1} ---\n{text}"
        
    # Heuristics for Title, Authors, and Abstract
    # Typically found on the first page
    first_page_text = pages[0]["text"] if pages else ""
    
    # 2. Extract Title Heuristics
    title = None
    # Check document metadata first
    meta_title = doc_fitz.metadata.get("title")
    if meta_title and len(meta_title.strip()) > 5:
        title = meta_title.strip()
    else:
        # Heuristic: First few non-empty lines of first page
        lines = [line.strip() for line in first_page_text.split("\n") if line.strip()]
        for line in lines[:3]:
            # Avoid lines with "abstract", "journal", "http", "vol"
            if len(line) > 10 and not any(kw in line.lower() for kw in ["abstract", "arxiv", "vol.", "no.", "http", "journal"]):
                title = line
                break
        if not title and lines:
            title = lines[0]
            
    # 3. Extract Abstract Heuristics
    abstract = ""
    abstract_match = re.search(
        r"(?:abstract|summary)[:\s]+(.*?)(?=\n\s*(?:introduction|1\s+|i\.\s+|background|methods|acknowledgements|references)|$)", 
        first_page_text, 
        re.IGNORECASE | re.DOTALL
    )
    if abstract_match:
        abstract = abstract_match.group(1).strip()
    else:
        # Try full text if first page didn't catch it
        abstract_match_full = re.search(
            r"(?:abstract|summary)[:\s]+(.*?)(?=\n\s*(?:introduction|1\s+|i\.\s+|background|methods|acknowledgements|references)|$)", 
            full_text[:4000], 
            re.IGNORECASE | re.DOTALL
        )
        if abstract_match_full:
            abstract = abstract_match_full.group(1).strip()
            
    # 4. Extract Authors Heuristics
    authors = None
    meta_author = doc_fitz.metadata.get("author")
    if meta_author and len(meta_author.strip()) > 3:
        authors = meta_author.strip()
    else:
        # Heuristic: Lines after Title before Abstract
        if title:
            title_idx = first_page_text.find(title)
            abstract_idx = first_page_text.lower().find("abstract")
            if title_idx != -1 and abstract_idx != -1 and title_idx < abstract_idx:
                between_text = first_page_text[title_idx + len(title):abstract_idx].strip()
                # Clean up between_text lines
                author_lines = [line.strip() for line in between_text.split("\n") if line.strip()]
                # Exclude university department strings, email addresses, etc.
                filtered_authors = []
                for line in author_lines:
                    if not any(kw in line.lower() for kw in ["department", "university", "school", "@", "instit", "lab"]):
                        # Keep lines that look like names (short, capitalized)
                        if len(line) < 100 and re.match(r"^[A-Z][a-zA-Z\s.,&]+$", line):
                            filtered_authors.append(line)
                if filtered_authors:
                    authors = ", ".join(filtered_authors)
        if not authors:
            authors = "Unknown Author"

    # 5. Extract References Section
    references_text = ""
    ref_match = re.search(
        r"(?:references|bibliography|literature cited)[:\s]+(.*)$", 
        full_text, 
        re.IGNORECASE | re.DOTALL
    )
    if ref_match:
        references_text = ref_match.group(1).strip()
        
    # 6. Extract Tables using pdfplumber (fallback/optional)
    tables = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page_idx, page in enumerate(pdf.pages[:5]):  # check first 5 pages for tables
                extracted_tables = page.extract_tables()
                for table in extracted_tables:
                    if table and any(any(cell for cell in row) for row in table):
                        tables.append({
                            "page": page_idx + 1,
                            "table": table
                        })
    except Exception as e:
        print(f"Error extracting tables with pdfplumber: {e}")
        
    doc_fitz.close()
    
    # Heuristic BibTeX generation
    author_clean = re.sub(r'[^a-zA-Z]', '', authors.split(",")[0].split(" ")[-1]).lower() if authors else "unknown"
    title_clean = re.sub(r'[^a-zA-Z0-9\s]', '', title.split(" ")[0] if title else "paper").lower()
    bibtex_key = f"{author_clean}2026{title_clean}"
    bibtex = f"""@article{{{bibtex_key},
  author = {{{authors}}},
  title = {{{title}}},
  journal = {{Academic Repository}},
  year = {{2026}},
  note = {{Uploaded to ResearchMind}}
}}"""

    return {
        "title": title or "Untitled Research Paper",
        "authors": authors,
        "abstract": abstract or "Abstract not found.",
        "pages": pages,
        "references": references_text[:5000],  # cap length
        "bibtex": bibtex,
        "tables_count": len(tables),
        "pages_count": len(pages)
    }
