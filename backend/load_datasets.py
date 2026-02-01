"""
Intellecta RAG Backend - Dataset Loader
Dataset download and ingestion script with progress tracking and versioning.
Supports OPSD, ORNL, NREL, and NAB datasets.
"""

import asyncio
import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ===== Configuration =====

DATA_DIR = Path(__file__).parent / "data"
DATASETS_DIR = DATA_DIR / "datasets"
DATASETS_REGISTRY_PATH = DATA_DIR / "datasets_registry.json"

# Dataset URLs
DATASET_SOURCES = {
    "opsd": {
        "name": "Open Power System Data (OPSD)",
        "description": "European power system data - generation capacity, power plants, time series",
        "files": [
            {
                "name": "time_series_60min.csv",
                "url": "https://data.open-power-system-data.org/time_series/2020-10-06/time_series_60min_singleindex.csv",
                "description": "Hourly time series of electricity consumption, generation, and prices"
            },
            {
                "name": "conventional_power_plants_EU.csv",
                "url": "https://data.open-power-system-data.org/conventional_power_plants/2020-10-01/conventional_power_plants_EU.csv",
                "description": "List of conventional power plants in Europe"
            },
            {
                "name": "renewable_power_plants_EU.csv",
                "url": "https://data.open-power-system-data.org/renewable_power_plants/2020-08-25/renewable_power_plants_EU.csv",
                "description": "List of renewable power plants in Europe"
            }
        ],
        "auto_update": True,
        "update_frequency_days": 30
    },
    "nab": {
        "name": "Numenta Anomaly Benchmark (NAB)",
        "description": "58 labeled time series for anomaly detection",
        "files": [
            {
                "name": "realAWSCloudwatch",
                "url": "https://raw.githubusercontent.com/numenta/NAB/master/data/realAWSCloudwatch/",
                "is_directory": True,
                "files_list": [
                    "ec2_cpu_utilization_24ae8d.csv",
                    "ec2_cpu_utilization_53ea38.csv",
                    "ec2_cpu_utilization_5f5533.csv",
                    "ec2_cpu_utilization_77c1ca.csv",
                    "ec2_cpu_utilization_825cc2.csv",
                    "ec2_cpu_utilization_ac20cd.csv",
                    "ec2_cpu_utilization_c6585a.csv",
                    "ec2_cpu_utilization_fe7f93.csv",
                    "ec2_disk_write_bytes_1ef3de.csv",
                    "ec2_disk_write_bytes_c0d644.csv",
                    "ec2_network_in_257a54.csv",
                    "ec2_network_in_5abac7.csv",
                    "elb_request_count_8c0756.csv",
                    "grok_asg_anomaly.csv",
                    "iio_us-east-1_i-a2eb1cd9_NetworkIn.csv",
                    "rds_cpu_utilization_cc0c53.csv",
                    "rds_cpu_utilization_e47b3b.csv"
                ]
            },
            {
                "name": "realTraffic",
                "url": "https://raw.githubusercontent.com/numenta/NAB/master/data/realTraffic/",
                "is_directory": True,
                "files_list": [
                    "occupancy_6005.csv",
                    "occupancy_t4013.csv",
                    "speed_6005.csv",
                    "speed_7578.csv",
                    "speed_t4013.csv",
                    "TravelTime_387.csv",
                    "TravelTime_451.csv"
                ]
            }
        ],
        "auto_update": False,
        "update_frequency_days": 365
    },
    "nrel": {
        "name": "DOE / NREL Open Reports",
        "description": "National Renewable Energy Laboratory - solar, wind, grid data",
        "files": [
            {
                "name": "pvwatts_hourly.json",
                "url_template": "https://developer.nrel.gov/api/pvwatts/v8.json?api_key={api_key}&system_capacity=4&module_type=0&losses=14&array_type=1&tilt=20&azimuth=180&lat=40&lon=-105",
                "requires_api_key": True,
                "description": "PVWatts hourly solar data for Colorado location"
            },
            {
                "name": "utility_rates.json",
                "url_template": "https://developer.nrel.gov/api/utility_rates/v3.json?api_key={api_key}&lat=40&lon=-105",
                "requires_api_key": True,
                "description": "Utility rates data for Colorado location"
            },
            {
                "name": "solar_resource_data.json",
                "url_template": "https://developer.nrel.gov/api/solar/solar_resource/v1.json?api_key={api_key}&lat=40&lon=-105",
                "requires_api_key": True,
                "description": "Solar resource data for Colorado location"
            }
        ],
        "auto_update": True,
        "update_frequency_days": 30,
        "note": "NREL data requires API key. Set NREL_API_KEY environment variable."
    },
    "ornl": {
        "name": "Oak Ridge National Laboratory - Power & Grid",
        "description": "US national lab data on power grids and critical infrastructure",
        "files": [],
        "auto_update": False,
        "update_frequency_days": 90,
        "note": "ORNL datasets require manual download from https://www.ornl.gov/data"
    }
}


class DatasetLoader:
    """Download and ingest training datasets."""
    
    def __init__(self):
        self.datasets_dir = DATASETS_DIR
        self.registry_path = DATASETS_REGISTRY_PATH
        self.progress: Dict[str, Dict] = {}
    
    def load_registry(self) -> Dict:
        """Load datasets registry."""
        try:
            if self.registry_path.exists():
                with open(self.registry_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading registry: {e}")
        return {"datasets": {}, "ingestion_status": {}, "last_updated": None}
    
    def save_registry(self, data: Dict):
        """Save datasets registry."""
        data["last_updated"] = datetime.now().isoformat()
        with open(self.registry_path, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    
    async def download_file(
        self, 
        url: str, 
        dest_path: Path,
        timeout: float = 300.0
    ) -> Tuple[bool, str]:
        """Download a file from URL."""
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                logger.info(f"Downloading: {url}")
                response = await client.get(url)
                
                if response.status_code == 200:
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(dest_path, 'wb') as f:
                        f.write(response.content)
                    
                    # Calculate checksum
                    checksum = hashlib.md5(response.content).hexdigest()
                    logger.info(f"Downloaded: {dest_path.name} ({len(response.content)} bytes)")
                    return True, checksum
                else:
                    logger.error(f"Download failed: {response.status_code}")
                    return False, f"HTTP {response.status_code}"
                    
        except Exception as e:
            logger.error(f"Download error: {e}")
            return False, str(e)
    
    async def download_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Download all files for a dataset."""
        if dataset_id not in DATASET_SOURCES:
            return {"success": False, "message": f"Unknown dataset: {dataset_id}"}
        
        source = DATASET_SOURCES[dataset_id]
        dataset_dir = self.datasets_dir / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        results = {
            "dataset": dataset_id,
            "name": source["name"],
            "files_downloaded": 0,
            "files_failed": 0,
            "files": []
        }
        
        self.progress[dataset_id] = {
            "status": "downloading",
            "progress": 0,
            "current_file": None,
            "files_processed": 0,
            "total_files": len(source.get("files", []))
        }
        
        for i, file_info in enumerate(source.get("files", [])):
            file_name = file_info.get("name", "")
            self.progress[dataset_id]["current_file"] = file_name
            
            # Handle files requiring API key
            if file_info.get("requires_api_key"):
                api_key = os.environ.get("NREL_API_KEY", "")
                if not api_key:
                    logger.warning(f"Skipping {file_name}: requires API key (set NREL_API_KEY)")
                    results["files"].append({
                        "name": file_name,
                        "success": False,
                        "message": "Requires API key - set NREL_API_KEY environment variable"
                    })
                    results["files_failed"] += 1
                    continue
                
                # Build URL from template with API key
                url_template = file_info.get("url_template", "")
                if url_template:
                    url = url_template.format(api_key=api_key)
                    dest = dataset_dir / file_name
                    success, checksum = await self.download_file(url, dest)
                    
                    results["files"].append({
                        "name": file_name,
                        "success": success,
                        "checksum": checksum if success else None,
                        "size": dest.stat().st_size if success and dest.exists() else 0
                    })
                    
                    if success:
                        results["files_downloaded"] += 1
                    else:
                        results["files_failed"] += 1
                    continue
            
            if file_info.get("is_directory"):
                # Download multiple files from directory
                for sub_file in file_info.get("files_list", []):
                    url = file_info["url"] + sub_file
                    dest = dataset_dir / file_name / sub_file
                    
                    success, checksum = await self.download_file(url, dest)
                    
                    results["files"].append({
                        "name": f"{file_name}/{sub_file}",
                        "success": success,
                        "checksum": checksum if success else None,
                        "size": dest.stat().st_size if success and dest.exists() else 0
                    })
                    
                    if success:
                        results["files_downloaded"] += 1
                    else:
                        results["files_failed"] += 1
            else:
                # Download single file
                url = file_info.get("url", "")
                if not url:
                    continue
                
                dest = dataset_dir / file_name
                success, checksum = await self.download_file(url, dest)
                
                results["files"].append({
                    "name": file_name,
                    "success": success,
                    "checksum": checksum if success else None,
                    "size": dest.stat().st_size if success and dest.exists() else 0
                })
                
                if success:
                    results["files_downloaded"] += 1
                else:
                    results["files_failed"] += 1
            
            self.progress[dataset_id]["files_processed"] = i + 1
            self.progress[dataset_id]["progress"] = (i + 1) / len(source["files"]) * 50  # 50% for download
        
        # Update registry
        registry = self.load_registry()
        if "datasets" not in registry:
            registry["datasets"] = {}
        
        # Get source URL (handle url_template)
        source_url = ""
        if source["files"]:
            first_file = source["files"][0]
            source_url = first_file.get("url") or first_file.get("url_template", "").split("?")[0]
        
        registry["datasets"][dataset_id] = {
            "name": source["name"],
            "description": source["description"],
            "source_url": source_url,
            "files": results["files"],
            "last_downloaded": datetime.now().isoformat(),
            "version": "1.0",
            "auto_update": source.get("auto_update", False),
            "update_frequency_days": source.get("update_frequency_days", 30)
        }
        self.save_registry(registry)
        
        self.progress[dataset_id]["status"] = "downloaded"
        return results
    
    async def ingest_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Ingest downloaded dataset files into the vector store."""
        from document_processor import document_processor
        from retriever import retriever
        from models import SecurityLevel
        
        dataset_dir = self.datasets_dir / dataset_id
        if not dataset_dir.exists():
            return {"success": False, "message": f"Dataset not downloaded: {dataset_id}"}
        
        results = {
            "dataset": dataset_id,
            "files_ingested": 0,
            "chunks_created": 0,
            "errors": []
        }
        
        self.progress[dataset_id] = self.progress.get(dataset_id, {})
        self.progress[dataset_id]["status"] = "ingesting"
        
        # Find all files
        files = list(dataset_dir.rglob("*.csv")) + \
                list(dataset_dir.rglob("*.json")) + \
                list(dataset_dir.rglob("*.txt"))
        
        total_files = len(files)
        self.progress[dataset_id]["total_files"] = total_files
        
        for i, file_path in enumerate(files):
            try:
                self.progress[dataset_id]["current_file"] = file_path.name
                
                # Process file
                chunks, doc_id = document_processor.process_file(
                    file_path=str(file_path),
                    filename=file_path.name,
                    security_level=SecurityLevel.PUBLIC,
                    source=dataset_id
                )
                
                # Add to vector store
                successful, failed = retriever.add_chunks(chunks)
                
                results["files_ingested"] += 1
                results["chunks_created"] += successful
                
                logger.info(f"Ingested {file_path.name}: {successful} chunks")
                
            except Exception as e:
                logger.error(f"Error ingesting {file_path}: {e}")
                results["errors"].append({
                    "file": str(file_path),
                    "error": str(e)
                })
            
            self.progress[dataset_id]["files_processed"] = i + 1
            self.progress[dataset_id]["progress"] = 50 + (i + 1) / total_files * 50  # 50-100%
        
        self.progress[dataset_id]["status"] = "complete"
        self.progress[dataset_id]["progress"] = 100
        
        # Update registry
        registry = self.load_registry()
        registry["ingestion_status"] = {
            "total_files": total_files,
            "ingested_files": results["files_ingested"],
            "failed_files": len(results["errors"]),
            "last_ingestion": datetime.now().isoformat(),
            "is_complete": len(results["errors"]) == 0
        }
        self.save_registry(registry)
        
        return results
    
    async def load_all_datasets(self) -> Dict[str, Any]:
        """Download and ingest all available datasets."""
        results = {
            "datasets_loaded": 0,
            "total_files": 0,
            "total_chunks": 0,
            "errors": []
        }
        
        for dataset_id in ["opsd", "nab"]:  # Skip nrel/ornl (require manual setup)
            logger.info(f"Processing dataset: {dataset_id}")
            
            # Download
            download_result = await self.download_dataset(dataset_id)
            if download_result.get("files_downloaded", 0) > 0:
                results["total_files"] += download_result["files_downloaded"]
                
                # Ingest
                ingest_result = await self.ingest_dataset(dataset_id)
                results["total_chunks"] += ingest_result.get("chunks_created", 0)
                results["datasets_loaded"] += 1
                
                if ingest_result.get("errors"):
                    results["errors"].extend(ingest_result["errors"])
        
        return results
    
    def get_progress(self) -> Dict[str, Dict]:
        """Get current loading progress."""
        return self.progress
    
    def check_updates_needed(self) -> List[str]:
        """Check which datasets need updates based on frequency."""
        registry = self.load_registry()
        needs_update = []
        
        for dataset_id, config in DATASET_SOURCES.items():
            if not config.get("auto_update", False):
                continue
            
            dataset_info = registry.get("datasets", {}).get(dataset_id, {})
            last_download = dataset_info.get("last_downloaded")
            
            if not last_download:
                needs_update.append(dataset_id)
                continue
            
            last_date = datetime.fromisoformat(last_download)
            days_since = (datetime.now() - last_date).days
            
            if days_since >= config.get("update_frequency_days", 30):
                needs_update.append(dataset_id)
        
        return needs_update


# ===== Global Loader Instance =====

dataset_loader = DatasetLoader()


# ===== CLI Interface =====

async def main():
    """CLI entry point for dataset loading."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Intellecta Dataset Loader")
    parser.add_argument("--download", "-d", nargs="+", help="Download specific datasets")
    parser.add_argument("--ingest", "-i", nargs="+", help="Ingest specific datasets")
    parser.add_argument("--all", "-a", action="store_true", help="Load all datasets")
    parser.add_argument("--check-updates", action="store_true", help="Check for dataset updates")
    parser.add_argument("--list", "-l", action="store_true", help="List available datasets")
    
    args = parser.parse_args()
    
    if args.list:
        print("\nAvailable Datasets:")
        print("=" * 50)
        for dataset_id, config in DATASET_SOURCES.items():
            print(f"\n{dataset_id}:")
            print(f"  Name: {config['name']}")
            print(f"  Description: {config['description']}")
            print(f"  Files: {len(config.get('files', []))}")
            if config.get("note"):
                print(f"  Note: {config['note']}")
        return
    
    if args.check_updates:
        needs_update = dataset_loader.check_updates_needed()
        if needs_update:
            print(f"Datasets needing update: {', '.join(needs_update)}")
        else:
            print("All datasets are up to date.")
        return
    
    if args.all:
        print("Loading all datasets...")
        results = await dataset_loader.load_all_datasets()
        print(f"\nResults:")
        print(f"  Datasets loaded: {results['datasets_loaded']}")
        print(f"  Total files: {results['total_files']}")
        print(f"  Total chunks: {results['total_chunks']}")
        if results['errors']:
            print(f"  Errors: {len(results['errors'])}")
        return
    
    if args.download:
        for dataset_id in args.download:
            print(f"Downloading {dataset_id}...")
            result = await dataset_loader.download_dataset(dataset_id)
            print(f"  Files downloaded: {result.get('files_downloaded', 0)}")
    
    if args.ingest:
        for dataset_id in args.ingest:
            print(f"Ingesting {dataset_id}...")
            result = await dataset_loader.ingest_dataset(dataset_id)
            print(f"  Chunks created: {result.get('chunks_created', 0)}")


if __name__ == "__main__":
    asyncio.run(main())
