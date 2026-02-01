"""
Intellecta RAG Backend - Dataset Pretraining Script
Processes all downloaded datasets, generates embeddings, and stores them in Qdrant + PostgreSQL.
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

import httpx
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))


class DatasetPretrainer:
    """Handles dataset pretraining and ingestion into Qdrant + PostgreSQL."""
    
    def __init__(self):
        self.datasets_dir = Path(__file__).parent / "data" / "datasets"
        self.total_chunks = 0
        self.total_files = 0
        self.db_manager = None
        self.retriever = None
        self.embedding_model = None
        
    async def initialize_components(self) -> bool:
        """Initialize all required components."""
        logger.info("=" * 60)
        logger.info("INTELLECTA DATASET PRETRAINING")
        logger.info("=" * 60)
        
        logger.info("\n[1/5] Initializing components...")
        
        # Initialize database
        logger.info("  - Connecting to PostgreSQL...")
        try:
            from database import db_manager
            self.db_manager = db_manager
            db_ok = await self.db_manager.initialize()
            if not db_ok:
                logger.error("Failed to connect to PostgreSQL.")
                logger.info("  Run: .\\setup_postgres.ps1")
                return False
            logger.info("  - PostgreSQL connected ✓")
        except Exception as e:
            logger.error(f"PostgreSQL error: {e}")
            logger.info("  Make sure PostgreSQL is running: .\\setup_postgres.ps1")
            return False
        
        # Initialize Qdrant
        logger.info("  - Connecting to Qdrant...")
        try:
            from retriever import retriever
            self.retriever = retriever
            qdrant_ok = await self.retriever.initialize()
            if not qdrant_ok:
                logger.error("Failed to connect to Qdrant.")
                logger.info("  Run: .\\setup_qdrant.ps1")
                return False
            logger.info("  - Qdrant connected ✓")
        except Exception as e:
            logger.error(f"Qdrant error: {e}")
            logger.info("  Make sure Qdrant is running: .\\setup_qdrant.ps1")
            return False
        
        # Load embedding model
        logger.info("  - Loading Qwen3-VL-Embedding-2B model...")
        try:
            from embedding import embedding_model, warmup_models
            self.embedding_model = embedding_model
            warmup_models()
            logger.info("  - Embedding models loaded ✓")
        except Exception as e:
            logger.error(f"Embedding model error: {e}")
            return False
        
        # Warmup LLM with keep_alive=-1
        logger.info("  - Loading LLaMA 3.2 8B (keep_alive=-1)...")
        await self.warmup_llm_persistent()
        logger.info("  - LLM loaded and will stay in memory ✓")
        
        return True
    
    async def warmup_llm_persistent(self):
        """Load LLM with keep_alive=-1 to keep it always loaded."""
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "llama3.2:latest",
                        "prompt": "System initialization. Respond with: Ready.",
                        "options": {"num_predict": 10},
                        "keep_alive": -1  # Keep model loaded forever
                    }
                )
                if response.status_code == 200:
                    logger.info("    LLM warmup successful with keep_alive=-1")
                else:
                    logger.warning(f"    LLM warmup returned status {response.status_code}")
        except Exception as e:
            logger.warning(f"    LLM warmup notice: {e}")
            logger.info("    Make sure Ollama is running: ollama serve")
            logger.info("    And pull the model: ollama pull llama3.2:latest")
    
    def chunk_text(self, text: str, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks."""
        if not text or len(text.strip()) == 0:
            return []
        
        words = text.split()
        if len(words) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(words):
            end = start + chunk_size
            chunk = " ".join(words[start:end])
            chunks.append(chunk)
            start = end - overlap
            
            if start >= len(words):
                break
        
        return chunks
    
    def read_csv_file(self, file_path: Path) -> str:
        """Read and convert CSV file to text representation."""
        try:
            # Read CSV with limited rows for large files
            df = pd.read_csv(file_path, nrows=5000)
            
            text_parts = [
                f"Dataset: {file_path.name}",
                f"Description: Power system and energy data from {file_path.parent.name} dataset",
                f"Columns: {', '.join(df.columns.tolist())}",
                f"Total Records: {len(df)} rows x {len(df.columns)} columns",
                "",
                "=== Column Statistics ===",
            ]
            
            # Add column statistics
            for col in df.columns[:30]:  # Limit to first 30 columns
                try:
                    if df[col].dtype in ['int64', 'float64']:
                        text_parts.append(
                            f"  {col}: min={df[col].min():.4f}, max={df[col].max():.4f}, "
                            f"mean={df[col].mean():.4f}, std={df[col].std():.4f}"
                        )
                    else:
                        unique_count = df[col].nunique()
                        text_parts.append(f"  {col}: {unique_count} unique values")
                        if unique_count <= 10:
                            text_parts.append(f"    Values: {df[col].unique().tolist()[:10]}")
                except:
                    pass
            
            # Add sample data
            text_parts.append("\n=== Sample Data (First 10 Rows) ===")
            text_parts.append(df.head(10).to_string())
            
            # Add data description for RAG context
            text_parts.append("\n=== Data Description ===")
            if "time" in file_path.name.lower() or any("time" in c.lower() for c in df.columns):
                text_parts.append("This dataset contains time series data related to power systems and energy.")
            if "power" in file_path.name.lower() or "plant" in file_path.name.lower():
                text_parts.append("This dataset contains information about power plants and generation capacity.")
            if "renewable" in file_path.name.lower():
                text_parts.append("This dataset focuses on renewable energy sources like solar, wind, and hydro.")
            if "cpu" in file_path.name.lower() or "ec2" in file_path.name.lower():
                text_parts.append("This dataset contains cloud computing metrics and CPU utilization data.")
            if "traffic" in file_path.name.lower() or "speed" in file_path.name.lower():
                text_parts.append("This dataset contains traffic and transportation data.")
            
            return "\n".join(text_parts)
            
        except Exception as e:
            logger.error(f"Error reading CSV {file_path}: {e}")
            return ""
    
    def read_json_file(self, file_path: Path) -> str:
        """Read and convert JSON file to text representation."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            text_parts = [
                f"Data Source: {file_path.name}",
                f"Dataset: NREL (National Renewable Energy Laboratory)",
                f"Description: Solar and energy resource data from NREL API",
                "",
                "=== Data Content ===",
                json.dumps(data, indent=2)
            ]
            
            # Add contextual description
            if "pvwatts" in file_path.name.lower():
                text_parts.append("\n=== Context ===")
                text_parts.append("PVWatts is NREL's tool for estimating energy production from photovoltaic (PV) systems.")
                text_parts.append("This data includes solar radiation, system capacity, and expected energy output.")
            elif "solar" in file_path.name.lower():
                text_parts.append("\n=== Context ===")
                text_parts.append("Solar resource data including direct normal irradiance (DNI), global horizontal irradiance (GHI).")
            elif "utility" in file_path.name.lower():
                text_parts.append("\n=== Context ===")
                text_parts.append("Utility rate data including residential and commercial electricity rates.")
            
            return "\n".join(text_parts)
            
        except Exception as e:
            logger.error(f"Error reading JSON {file_path}: {e}")
            return ""
    
    def read_pdf_file(self, file_path: Path) -> str:
        """Read and extract text from PDF file."""
        try:
            import fitz  # PyMuPDF
            
            doc = fitz.open(file_path)
            text_parts = [
                f"Document: {file_path.name}",
                f"Source: Oak Ridge National Laboratory (ORNL)",
                f"Description: Power grid and critical infrastructure research",
                f"Pages: {len(doc)}",
                "",
                "=== Document Content ===",
            ]
            
            for page_num, page in enumerate(doc):
                page_text = page.get_text()
                if page_text.strip():
                    text_parts.append(f"\n--- Page {page_num + 1} ---")
                    text_parts.append(page_text)
            
            doc.close()
            return "\n".join(text_parts)
            
        except Exception as e:
            logger.error(f"Error reading PDF {file_path}: {e}")
            return ""
    
    def read_file_content(self, file_path: Path) -> str:
        """Read content from various file types."""
        suffix = file_path.suffix.lower()
        
        if suffix == ".csv":
            return self.read_csv_file(file_path)
        elif suffix == ".json":
            return self.read_json_file(file_path)
        elif suffix == ".pdf":
            return self.read_pdf_file(file_path)
        elif suffix in [".txt", ".md"]:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Error reading {file_path}: {e}")
                return ""
        else:
            logger.warning(f"Unsupported file type: {suffix}")
            return ""
    
    async def process_dataset(self, dataset_id: str, config: Dict) -> int:
        """Process a single dataset and return chunk count."""
        from models import SecurityLevel
        
        dataset_dir = self.datasets_dir / dataset_id
        
        if not dataset_dir.exists():
            logger.warning(f"  Skipping {dataset_id}: directory not found")
            return 0
        
        logger.info(f"\n  Processing {config['name']}...")
        
        # Register dataset in PostgreSQL
        await self.db_manager.register_dataset(
            dataset_name=dataset_id,
            description=config["description"],
            source_url=f"local:{dataset_dir}"
        )
        
        # Find all files
        files = []
        for ext in config["extensions"]:
            files.extend(dataset_dir.rglob(f"*{ext}"))
        
        if not files:
            logger.warning(f"    No files found for {dataset_id}")
            return 0
        
        logger.info(f"    Found {len(files)} files")
        
        dataset_chunks = 0
        security_level = config["security_level"]
        
        for file_path in files:
            try:
                logger.info(f"    Processing: {file_path.name}")
                
                # Read file content
                content = self.read_file_content(file_path)
                if not content or len(content.strip()) < 50:
                    logger.warning(f"      Skipping {file_path.name}: insufficient content")
                    continue
                
                # Create document in PostgreSQL
                doc_id = await self.db_manager.insert_document(
                    filename=file_path.name,
                    file_type=file_path.suffix.lower(),
                    file_size=file_path.stat().st_size,
                    security_level=security_level.value,
                    metadata={"dataset": dataset_id, "path": str(file_path)}
                )
                
                # Chunk the content
                chunks = self.chunk_text(content, chunk_size=400, overlap=50)
                
                if not chunks:
                    logger.warning(f"      No chunks generated for {file_path.name}")
                    continue
                
                logger.info(f"      Generated {len(chunks)} chunks")
                
                # Generate embeddings and store in Qdrant
                successful_chunks = 0
                for i, chunk in enumerate(chunks):
                    try:
                        chunk_id = await self.retriever.add_document(
                            text=chunk,
                            metadata={
                                "document_id": doc_id,
                                "filename": file_path.name,
                                "chunk_index": i,
                                "dataset": dataset_id,
                                "security_level": security_level.value
                            },
                            security_level=security_level
                        )
                        
                        if chunk_id:
                            successful_chunks += 1
                            dataset_chunks += 1
                    except Exception as e:
                        logger.error(f"      Error storing chunk {i}: {e}")
                
                logger.info(f"      Stored {successful_chunks}/{len(chunks)} chunks in Qdrant")
                
                # Update document chunk count
                await self.db_manager.update_document_chunk_count(doc_id, successful_chunks)
                self.total_files += 1
                
            except Exception as e:
                logger.error(f"    Error processing {file_path.name}: {e}")
                continue
        
        # Update dataset status
        await self.db_manager.update_dataset_status(
            dataset_name=dataset_id,
            status="ingested",
            chunk_count=dataset_chunks,
            last_ingested=datetime.now()
        )
        
        return dataset_chunks
    
    async def run(self):
        """Main entry point for pretraining."""
        from models import SecurityLevel
        
        # Initialize components
        if not await self.initialize_components():
            logger.error("Failed to initialize components. Exiting.")
            return False
        
        # Dataset configurations
        datasets = {
            "opsd": {
                "name": "Open Power System Data (OPSD)",
                "description": "European power system data including generation capacity, power plants, and time series",
                "security_level": SecurityLevel.PUBLIC,
                "extensions": [".csv"]
            },
            "nab": {
                "name": "Numenta Anomaly Benchmark (NAB)",
                "description": "Time series data for anomaly detection in cloud computing and traffic systems",
                "security_level": SecurityLevel.PUBLIC,
                "extensions": [".csv"]
            },
            "nrel": {
                "name": "NREL Solar/Energy Data",
                "description": "National Renewable Energy Laboratory solar radiation and utility rate data",
                "security_level": SecurityLevel.INTERNAL,
                "extensions": [".json"]
            },
            "ornl": {
                "name": "Oak Ridge National Laboratory",
                "description": "Power grid and critical infrastructure research documents",
                "security_level": SecurityLevel.CONFIDENTIAL,
                "extensions": [".pdf"]
            }
        }
        
        logger.info("\n[2/5] Processing datasets...")
        
        for dataset_id, config in datasets.items():
            chunks = await self.process_dataset(dataset_id, config)
            self.total_chunks += chunks
            logger.info(f"    ✓ {dataset_id}: {chunks} chunks ingested")
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("PRETRAINING COMPLETE")
        logger.info("=" * 60)
        logger.info(f"  Total files processed: {self.total_files}")
        logger.info(f"  Total chunks created: {self.total_chunks}")
        
        # Get stats from database
        try:
            stats = await self.db_manager.get_system_stats()
            logger.info(f"\nDatabase Statistics:")
            logger.info(f"  Documents in PostgreSQL: {stats['documents']['total_documents']}")
            logger.info(f"  Chunks tracked: {stats['documents']['total_chunks']}")
            
            # Get Qdrant stats
            qdrant_count = await self.retriever.get_collection_count()
            logger.info(f"  Vectors in Qdrant: {qdrant_count}")
        except Exception as e:
            logger.warning(f"Could not fetch stats: {e}")
        
        # Close connections
        await self.db_manager.close()
        
        logger.info("\n✅ Pretraining completed successfully!")
        logger.info("   You can now start the backend with: python main.py")
        
        return True


async def main():
    """Main function."""
    print("""
╔══════════════════════════════════════════════════════════════╗
║           INTELLECTA DATASET PRETRAINING SCRIPT              ║
╠══════════════════════════════════════════════════════════════╣
║  This script will:                                           ║
║  1. Connect to PostgreSQL (metadata storage)                 ║
║  2. Connect to Qdrant (vector storage)                       ║
║  3. Load Qwen3-VL-Embedding-2B model                         ║
║  4. Load LLaMA 3.2 8B with keep_alive=-1                     ║
║  5. Process all datasets (OPSD, NAB, NREL, ORNL)             ║
║  6. Generate embeddings and store in Qdrant                  ║
║  7. Store metadata in PostgreSQL                             ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    pretrainer = DatasetPretrainer()
    await pretrainer.run()


if __name__ == "__main__":
    asyncio.run(main())
