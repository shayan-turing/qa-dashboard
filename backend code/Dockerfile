# Use lightweight Python image
FROM python:3.11-slim

# Create app directory
WORKDIR /app

# Copy only requirements first (for efficient caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Expose port for Flask / Gunicorn
EXPOSE 8080

# Use Gunicorn (production WSGI server)
CMD exec gunicorn --bind :8080 --workers 4 --threads 8 --timeout 0 app:app
