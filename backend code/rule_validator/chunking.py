from langchain.text_splitter import RecursiveCharacterTextSplitter

def chunk_document(text: str, chunk_size=100000, overlap=500):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=overlap
    )
    return splitter.split_text(text)
