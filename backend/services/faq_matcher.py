import re
from typing import Optional

from apps.knowledge.models import KnowledgeItem


def _normalize(text: str) -> str:
    return re.sub(r'\s+', ' ', text.lower().strip())


def _score(text: str, item: KnowledgeItem) -> float:
    """
    Keyword + question-overlap scoring.
    No external AI needed in Phase 1.
    """
    norm = _normalize(text)
    score = 0.0

    for kw in item.get_keywords_list():
        if kw in norm:
            score += 2.0

    q_words = set(_normalize(item.question).split())
    t_words = set(norm.split())
    overlap = q_words & t_words
    if q_words:
        score += (len(overlap) / len(q_words)) * 3.0

    return score


def find_best_match(
    text: str, tenant, min_score: float = 1.5
) -> Optional[KnowledgeItem]:
    """
    Return the best-matching active KnowledgeItem for *this tenant only*.
    Returns None when confidence is below min_score (→ escalate to human).
    """
    items = KnowledgeItem.objects.filter(
        tenant=tenant, is_active=True
    ).order_by('-priority')

    best_item: Optional[KnowledgeItem] = None
    best_score = 0.0

    for item in items:
        s = _score(text, item)
        if s > best_score:
            best_score = s
            best_item = item

    return best_item if best_score >= min_score else None
