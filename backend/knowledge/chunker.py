import fitz
from pathlib import Path

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extracts text from a PDF file using PyMuPDF.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")
        
    doc = fitz.open(str(path.resolve()))
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    doc.close()
    return text

def chunk_text(text: str, chunk_size: int = 900, overlap: int = 175) -> list[dict]:
    """
    Chunks text into character-based overlapping windows.
    Target: 800-1000 characters, overlap 150-200 characters.
    Defaults to 900 character size with 175 character overlap.
    """
    chunks = []
    if not text:
        return chunks
        
    # Clean whitespace slightly
    cleaned_text = " ".join(text.split())
    text_len = len(cleaned_text)
    start = 0
    chunk_num = 0
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunk_content = cleaned_text[start:end]
        
        chunks.append({
            "text": chunk_content,
            "chunk_number": chunk_num
        })
        
        chunk_num += 1
        
        if end == text_len:
            break
            
        start += (chunk_size - overlap)
        
    return chunks

def extract_and_chunk_pdf(pdf_path: str) -> list[dict]:
    """
    Extracts and chunks text from a PDF.
    """
    text = extract_text_from_pdf(pdf_path)
    return chunk_text(text)
