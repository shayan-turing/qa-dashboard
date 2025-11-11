import os
from docx import Document
import chardet

def read_file(file_path: str) -> str:
    """
    Reads text content from a given file path.
    Supports .txt, .md, and .docx formats.
    Automatically detects encoding for text files.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"❌ File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    # -------------------------------
    # Plain text / Markdown
    # -------------------------------
    if ext in [".txt", ".md"]:
        # Detect encoding automatically to handle varied sources
        with open(file_path, "rb") as f:
            raw_data = f.read()
            detected = chardet.detect(raw_data)
            encoding = detected.get("encoding", "utf-8") or "utf-8"

        try:
            text = raw_data.decode(encoding, errors="ignore")
        except Exception:
            text = raw_data.decode("utf-8", errors="ignore")

        return text.strip()

    # -------------------------------
    # Microsoft Word (.docx)
    # -------------------------------
    elif ext == ".docx":
        try:
            doc = Document(file_path)
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paragraphs)
        except Exception as e:
            raise ValueError(f"❌ Error reading DOCX file: {e}")

    # -------------------------------
    # PDF (optional extension)
    # -------------------------------
    # elif ext == ".pdf":
    #     try:
    #         from PyPDF2 import PdfReader
    #         reader = PdfReader(file_path)
    #         text = "\n".join([page.extract_text() or "" for page in reader.pages])
    #         return text.strip()
    #     except Exception as e:
    #         raise ValueError(f"❌ Error reading PDF file: {e}")

    else:
        raise ValueError(f"⚠️ Unsupported file format: {ext}")
