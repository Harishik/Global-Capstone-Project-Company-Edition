"""
Intellecta RAG Backend - Security Framework
5-level security system with pattern detection and dual security checking.
"""

import re
from typing import Dict, List, Optional, Tuple
from models import SecurityLevel, SecurityInfo, SecurityFinding, SecurityAutoDetectResponse


# ===== Security Level Mapping =====

SECURITY_LEVEL_VALUES: Dict[SecurityLevel, int] = {
    SecurityLevel.PUBLIC: 0,
    SecurityLevel.INTERNAL: 1,
    SecurityLevel.CONFIDENTIAL: 2,
    SecurityLevel.RESTRICTED: 3,
    SecurityLevel.TOP_SECRET: 4,
}

SECURITY_VALUE_TO_LEVEL: Dict[int, SecurityLevel] = {
    v: k for k, v in SECURITY_LEVEL_VALUES.items()
}


# ===== Sensitive Pattern Definitions =====

SECURITY_PATTERNS: Dict[SecurityLevel, List[Dict]] = {
    SecurityLevel.TOP_SECRET: [
        {
            "type": "critical_infrastructure",
            "patterns": [
                r"\b(nuclear|reactor|enrichment|uranium|plutonium)\b",
                r"\b(scada|ics|plc|dcs|hmi)\s*(system|control|network)",
                r"\b(grid\s*attack|cyber\s*attack|vulnerability\s*exploit)",
                r"\b(classified|top\s*secret|ts/sci)\b",
            ],
            "description": "Critical infrastructure and classified content"
        },
        {
            "type": "national_security",
            "patterns": [
                r"\b(defense|military|weapon|ammunition)\s*(system|facility|program)",
                r"\b(intelligence|espionage|covert|clandestine)\b",
            ],
            "description": "National security related content"
        },
    ],
    SecurityLevel.RESTRICTED: [
        {
            "type": "pii_ssn",
            "patterns": [
                r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b",  # SSN format
            ],
            "description": "Social Security Numbers"
        },
        {
            "type": "pii_financial",
            "patterns": [
                r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",  # Credit card
                r"\b(bank\s*account|routing\s*number|iban|swift)\s*[:=]?\s*\d+",
            ],
            "description": "Financial account information"
        },
        {
            "type": "credentials",
            "patterns": [
                r"\b(password|passwd|pwd|secret|api[_\s]?key|token)\s*[:=]\s*\S+",
                r"\b(private\s*key|ssh\s*key|rsa\s*key)",
            ],
            "description": "Credentials and access keys"
        },
        {
            "type": "medical",
            "patterns": [
                r"\b(patient|medical\s*record|diagnosis|prescription|hipaa)\b",
                r"\b(health\s*insurance|medical\s*history)\b",
            ],
            "description": "Medical and health records"
        },
    ],
    SecurityLevel.CONFIDENTIAL: [
        {
            "type": "salary_compensation",
            "patterns": [
                r"\b(salary|compensation|wage|bonus|stock\s*option)\s*[:=]?\s*\$?\d+",
                r"\b(annual\s*income|pay\s*grade|hourly\s*rate)\b",
            ],
            "description": "Salary and compensation data"
        },
        {
            "type": "proprietary",
            "patterns": [
                r"\b(proprietary|trade\s*secret|confidential|nda)\b",
                r"\b(internal\s*only|do\s*not\s*distribute)\b",
            ],
            "description": "Proprietary business information"
        },
        {
            "type": "financial_reports",
            "patterns": [
                r"\b(revenue|profit|loss|earnings|quarterly\s*report)\s*[:=]?\s*\$?\d+",
                r"\b(forecast|projection|budget)\s*[:=]?\s*\$?\d+",
            ],
            "description": "Financial reports and projections"
        },
        {
            "type": "energy_sensitive",
            "patterns": [
                r"\b(power\s*plant|generation\s*capacity|grid\s*topology)\s*(data|info|detail)",
                r"\b(substation|transformer|transmission\s*line)\s*(location|coordinate)",
            ],
            "description": "Sensitive energy infrastructure details"
        },
    ],
    SecurityLevel.INTERNAL: [
        {
            "type": "employee_info",
            "patterns": [
                r"\b(employee\s*id|staff\s*number|personnel)\s*[:=]?\s*\w+",
                r"\b(internal\s*memo|internal\s*communication)\b",
            ],
            "description": "Employee and internal communications"
        },
        {
            "type": "operational",
            "patterns": [
                r"\b(maintenance\s*schedule|outage\s*plan|operational\s*procedure)\b",
                r"\b(internal\s*process|workflow|sop)\b",
            ],
            "description": "Operational procedures"
        },
    ],
}

# Keywords that trigger security checks in queries
QUERY_SECURITY_KEYWORDS: Dict[SecurityLevel, List[str]] = {
    SecurityLevel.TOP_SECRET: [
        "nuclear", "reactor", "scada", "ics", "classified", "top secret",
        "cyber attack", "vulnerability", "exploit", "defense system",
    ],
    SecurityLevel.RESTRICTED: [
        "ssn", "social security", "credit card", "bank account", "password",
        "api key", "private key", "patient", "medical record", "hipaa",
    ],
    SecurityLevel.CONFIDENTIAL: [
        "salary", "compensation", "bonus", "revenue", "profit", "earnings",
        "proprietary", "trade secret", "nda", "grid topology", "substation location",
    ],
    SecurityLevel.INTERNAL: [
        "employee id", "internal memo", "maintenance schedule", "outage plan",
    ],
}


class SecurityChecker:
    """Security checking engine with dual-level analysis."""
    
    def __init__(self):
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Pre-compile regex patterns for performance."""
        self.compiled_patterns: Dict[SecurityLevel, List[Tuple[Dict, re.Pattern]]] = {}
        
        for level, pattern_groups in SECURITY_PATTERNS.items():
            self.compiled_patterns[level] = []
            for group in pattern_groups:
                for pattern in group["patterns"]:
                    compiled = re.compile(pattern, re.IGNORECASE)
                    self.compiled_patterns[level].append((group, compiled))
    
    def check_query_security(self, query: str) -> Tuple[SecurityLevel, Optional[str]]:
        """
        Check query text for security-sensitive keywords.
        Returns (detected_level, matched_keyword).
        """
        query_lower = query.lower()
        
        # Check from highest to lowest security level
        for level in [SecurityLevel.TOP_SECRET, SecurityLevel.RESTRICTED, 
                      SecurityLevel.CONFIDENTIAL, SecurityLevel.INTERNAL]:
            keywords = QUERY_SECURITY_KEYWORDS.get(level, [])
            for keyword in keywords:
                if keyword in query_lower:
                    return level, keyword
        
        return SecurityLevel.PUBLIC, None
    
    def check_content_security(self, content: str) -> Tuple[SecurityLevel, List[SecurityFinding]]:
        """
        Check document content for sensitive patterns.
        Returns (detected_level, list of findings).
        """
        findings: List[SecurityFinding] = []
        highest_level = SecurityLevel.PUBLIC
        
        # Check from highest to lowest security level
        for level in [SecurityLevel.TOP_SECRET, SecurityLevel.RESTRICTED,
                      SecurityLevel.CONFIDENTIAL, SecurityLevel.INTERNAL]:
            for group, pattern in self.compiled_patterns.get(level, []):
                matches = pattern.findall(content)
                if matches:
                    # Handle tuples from regex groups - convert to strings
                    unique_matches = []
                    for match in matches[:5]:
                        if isinstance(match, tuple):
                            # Join tuple elements or take first non-empty
                            match_str = ' '.join(str(m) for m in match if m)
                        else:
                            match_str = str(match)
                        if match_str and match_str not in unique_matches:
                            unique_matches.append(match_str)
                    
                    finding = SecurityFinding(
                        type=group["type"],
                        pattern=pattern.pattern,
                        matches=unique_matches,
                        level=level
                    )
                    findings.append(finding)
                    
                    if SECURITY_LEVEL_VALUES[level] > SECURITY_LEVEL_VALUES[highest_level]:
                        highest_level = level
        
        return highest_level, findings
    
    def dual_security_check(
        self, 
        query: str, 
        content: str,
        user_clearance: SecurityLevel
    ) -> SecurityInfo:
        """
        Perform dual security check on both query and content.
        Effective level = max(query_level, content_level).
        """
        # Check query
        query_level, matched_keyword = self.check_query_security(query)
        
        # Check content
        content_level, _ = self.check_content_security(content)
        
        # Determine effective level
        query_value = SECURITY_LEVEL_VALUES[query_level]
        content_value = SECURITY_LEVEL_VALUES[content_level]
        effective_value = max(query_value, content_value)
        effective_level = SECURITY_VALUE_TO_LEVEL[effective_value]
        
        # Check access
        user_value = SECURITY_LEVEL_VALUES[user_clearance]
        access_allowed = user_value >= effective_value
        
        # Generate warning if needed
        warning = None
        if not access_allowed:
            warning = f"Access denied. Content requires {effective_level.value} clearance."
        elif effective_value > 0:
            warning = f"Content classified as {effective_level.value}."
        
        return SecurityInfo(
            level=effective_level,
            level_value=effective_value,
            warning=warning,
            matched_keyword=matched_keyword,
            access_allowed=access_allowed
        )
    
    def auto_detect_security(self, content: str) -> SecurityAutoDetectResponse:
        """
        Auto-detect security level for document content.
        Returns detailed analysis with confidence score.
        """
        level, findings = self.check_content_security(content)
        level_value = SECURITY_LEVEL_VALUES[level]
        
        # Calculate confidence based on number and severity of findings
        if not findings:
            confidence = 1.0  # High confidence for PUBLIC
        else:
            # More findings at higher levels = higher confidence
            weighted_score = sum(
                SECURITY_LEVEL_VALUES[f.level] * (len(f.matches) if f.matches else 1)
                for f in findings
            )
            max_possible = len(findings) * 4 * 5  # Max level * max matches per finding
            confidence = min(0.5 + (weighted_score / max(max_possible, 1)) * 0.5, 1.0)
        
        # Generate recommendation
        recommendations = {
            SecurityLevel.PUBLIC: "Document can be shared publicly.",
            SecurityLevel.INTERNAL: "Document should be limited to internal personnel.",
            SecurityLevel.CONFIDENTIAL: "Document contains confidential data. Restrict access.",
            SecurityLevel.RESTRICTED: "Document contains highly sensitive PII/credentials. Strict access control required.",
            SecurityLevel.TOP_SECRET: "Document contains critical/classified information. Maximum security required.",
        }
        
        return SecurityAutoDetectResponse(
            detected_level=level,
            level_value=level_value,
            confidence=round(confidence, 2),
            findings_count=len(findings),
            findings=findings,
            recommendation=recommendations[level]
        )
    
    def filter_chunks_by_clearance(
        self,
        chunks: List[dict],
        user_clearance: SecurityLevel
    ) -> Tuple[List[dict], int]:
        """
        Filter chunks based on user's security clearance.
        Returns (allowed_chunks, blocked_count).
        """
        user_value = SECURITY_LEVEL_VALUES[user_clearance]
        allowed = []
        blocked = 0
        
        for chunk in chunks:
            chunk_level = chunk.get("security_level", SecurityLevel.PUBLIC)
            if isinstance(chunk_level, str):
                chunk_level = SecurityLevel(chunk_level)
            
            chunk_value = SECURITY_LEVEL_VALUES[chunk_level]
            
            if user_value >= chunk_value:
                allowed.append(chunk)
            else:
                blocked += 1
        
        return allowed, blocked


# Global security checker instance
security_checker = SecurityChecker()


# ===== Utility Functions =====

def get_security_level_value(level: SecurityLevel) -> int:
    """Get numeric value for security level."""
    return SECURITY_LEVEL_VALUES[level]


def get_security_level_from_value(value: int) -> SecurityLevel:
    """Get security level from numeric value."""
    return SECURITY_VALUE_TO_LEVEL.get(value, SecurityLevel.PUBLIC)


def check_access(user_level: SecurityLevel, required_level: SecurityLevel) -> bool:
    """Check if user has sufficient clearance."""
    return SECURITY_LEVEL_VALUES[user_level] >= SECURITY_LEVEL_VALUES[required_level]
