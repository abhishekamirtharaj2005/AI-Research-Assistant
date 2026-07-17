from backend.app.rag.vectorstore import chunk_text_by_pages

def test_chunk_text_by_pages():
    pages = [
        {"page_number": 1, "text": "This is page one text. It contains some words to test the page aligned semantic chunker."},
        {"page_number": 2, "text": "This is page two text. It has more content for testing."}
    ]
    
    chunks = chunk_text_by_pages(pages, chunk_size=30, chunk_overlap=10)
    
    assert len(chunks) > 0
    assert chunks[0]["page_number"] == 1
    assert "page one" in chunks[0]["content"]
    
    # Check page alignment: page 2 text should not bleed into page 1 chunks
    page_1_chunks = [c for c in chunks if c["page_number"] == 1]
    for c in page_1_chunks:
        assert "page two" not in c["content"]
