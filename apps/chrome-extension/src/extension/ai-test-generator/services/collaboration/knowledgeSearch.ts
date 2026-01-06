/**
 * Knowledge Search Service
 *
 * Full-text search for knowledge base articles.
 */

import type { KnowledgeArticle } from '../../types/collaboration';
import type { IKnowledgeSearch, SearchResult } from './interfaces';

/**
 * Search term with position
 */
interface SearchTerm {
  term: string;
  positions: number[]; // Character positions in content
}

/**
 * Document index
 */
interface DocumentIndex {
  articleId: string;
  title: string;
  content: string;
  tags: string[];
  terms: Map<string, number>; // term -> frequency
  termPositions: Map<string, number[]>; // term -> positions
}

/**
 * Search result with score
 */
interface ScoredResult {
  articleId: string;
  score: number;
  highlights: string[];
}

/**
 * Knowledge Search Implementation
 */
export class KnowledgeSearch implements IKnowledgeSearch {
  private index: Map<string, DocumentIndex>;
  private stopwords: Set<string>;

  constructor() {
    this.index = new Map();
    this.stopwords = new Set([
      'a',
      'an',
      'and',
      'are',
      'as',
      'at',
      'be',
      'by',
      'for',
      'from',
      'has',
      'he',
      'in',
      'is',
      'it',
      'its',
      'of',
      'on',
      'that',
      'the',
      'to',
      'was',
      'were',
      'will',
      'with',
      'the',
      'this',
      'but',
      'they',
      'have',
      'had',
      'what',
      'when',
      'where',
      'who',
      'which',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'can',
      'just',
      'should',
      'now',
      // Common Chinese stopwords
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      '上',
      '也',
      '很',
      '到',
      '说',
      '要',
      '去',
      '你',
      '会',
      '着',
      '没有',
      '看',
      '好',
      '自己',
      '这',
    ]);
  }

  /**
   * Index an article for search
   */
  async indexArticle(article: KnowledgeArticle): Promise<void> {
    const terms = new Map<string, number>();
    const termPositions = new Map<string, number[]>();

    // Tokenize and index title (higher weight)
    const titleText = this.normalizeText(article.title);
    this.tokenize(titleText).forEach((term) => {
      terms.set(term, (terms.get(term) || 0) + 3); // Title gets 3x weight
    });

    // Tokenize and index content
    const contentText = this.normalizeText(article.content);
    const tokens = this.tokenize(contentText);

    tokens.forEach((term, position) => {
      terms.set(term, (terms.get(term) || 0) + 1);

      if (!termPositions.has(term)) {
        termPositions.set(term, []);
      }
      termPositions.get(term)!.push(position);
    });

    // Index tags
    for (const tag of article.tags) {
      const normalizedTag = this.normalizeText(tag);
      terms.set(normalizedTag, (terms.get(normalizedTag) || 0) + 2); // Tags get 2x weight
    }

    const docIndex: DocumentIndex = {
      articleId: article.id,
      title: article.title,
      content: article.content,
      tags: article.tags,
      terms,
      termPositions,
    };

    this.index.set(article.id, docIndex);
  }

  /**
   * Remove an article from index
   */
  async removeArticle(articleId: string): Promise<void> {
    this.index.delete(articleId);
  }

  /**
   * Search for articles
   */
  async search(query: string, limit = 20): Promise<string[]> {
    const normalizedQuery = this.normalizeText(query);
    const terms = this.tokenize(normalizedQuery);

    if (terms.length === 0) {
      return [];
    }

    // Calculate scores for each document
    const results: ScoredResult[] = [];

    for (const [articleId, docIndex] of this.index.entries()) {
      let score = 0;
      const highlights: string[] = [];

      for (const term of terms) {
        const frequency = docIndex.terms.get(term) || 0;
        if (frequency > 0) {
          // TF score (term frequency)
          score += frequency;

          // Generate highlight
          const positions = docIndex.termPositions.get(term);
          if (positions && positions.length > 0) {
            const highlight = this.generateHighlight(
              docIndex.content,
              positions[0],
            );
            if (highlight && !highlights.includes(highlight)) {
              highlights.push(highlight);
            }
          }
        }
      }

      if (score > 0) {
        results.push({ articleId, score, highlights });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit).map((r) => r.articleId);
  }

  /**
   * Search with detailed results
   */
  async searchDetailed(query: string, limit = 20): Promise<SearchResult[]> {
    const articleIds = await this.search(query, limit);
    const results: SearchResult[] = [];

    for (const id of articleIds) {
      const docIndex = this.index.get(id);
      if (docIndex) {
        results.push({
          articleId: id,
          title: docIndex.title,
          snippet: this.generateSnippet(docIndex.content, query),
          score: 0, // Recalculate if needed
        });
      }
    }

    return results;
  }

  /**
   * Suggest similar articles
   */
  async suggestSimilar(articleId: string, limit = 5): Promise<string[]> {
    const docIndex = this.index.get(articleId);
    if (!docIndex) {
      return [];
    }

    // Calculate similarity based on shared terms
    const similarities: { id: string; score: number }[] = [];

    for (const [id, otherDoc] of this.index.entries()) {
      if (id === articleId) continue;

      let sharedTerms = 0;
      let totalTerms = 0;

      for (const [term, freq] of docIndex.terms.entries()) {
        totalTerms += freq;
        if (otherDoc.terms.has(term)) {
          sharedTerms += Math.min(freq, otherDoc.terms.get(term) || 0);
        }
      }

      if (sharedTerms > 0) {
        // Jaccard-like similarity
        const otherTotal = Array.from(otherDoc.terms.values()).reduce(
          (a, b) => a + b,
          0,
        );
        const score = sharedTerms / (totalTerms + otherTotal - sharedTerms);
        similarities.push({ id, score });
      }
    }

    similarities.sort((a, b) => b.score - a.score);
    return similarities.slice(0, limit).map((s) => s.id);
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(prefix: string, limit = 10): Promise<string[]> {
    const normalized = this.normalizeText(prefix);
    const suggestions = new Set<string>();

    // Find terms that start with prefix
    for (const docIndex of this.index.values()) {
      for (const term of docIndex.terms.keys()) {
        if (term.startsWith(normalized)) {
          suggestions.add(term);
        }
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get trending search terms
   */
  async getTrendingTerms(limit = 10): Promise<string[]> {
    const termCounts = new Map<string, number>();

    // Aggregate term frequencies across all documents
    for (const docIndex of this.index.values()) {
      for (const [term, freq] of docIndex.terms.entries()) {
        termCounts.set(term, (termCounts.get(term) || 0) + freq);
      }
    }

    // Sort by frequency
    const sorted = Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map((t) => t[0]);
  }

  /**
   * Clear the search index
   */
  async clearIndex(): Promise<void> {
    this.index.clear();
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    documentCount: number;
    totalTerms: number;
    uniqueTerms: number;
  }> {
    let totalTerms = 0;
    const uniqueTerms = new Set<string>();

    for (const docIndex of this.index.values()) {
      for (const [term, freq] of docIndex.terms.entries()) {
        totalTerms += freq;
        uniqueTerms.add(term);
      }
    }

    return {
      documentCount: this.index.size,
      totalTerms,
      uniqueTerms: uniqueTerms.size,
    };
  }

  /**
   * Normalize text for search
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/<[^\>]*>/g, '') // Strip HTML
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // Keep alphanumeric, Chinese, and whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    const terms: string[] = [];

    // Split by whitespace
    const words = text.split(/\s+/);

    for (const word of words) {
      if (word.length > 1 && !this.stopwords.has(word)) {
        terms.push(word);

        // Also extract n-grams for Chinese
        if (/[\u4e00-\u9fa5]/.test(word)) {
          for (let i = 0; i < word.length - 1; i++) {
            const bigram = word.slice(i, i + 2);
            if (bigram.length === 2) {
              terms.push(bigram);
            }
          }
        }
      }
    }

    return terms;
  }

  /**
   * Generate highlight snippet
   */
  private generateHighlight(content: string, position: number): string {
    const snippetLength = 150;
    const start = Math.max(0, position - snippetLength / 2);
    const end = Math.min(content.length, position + snippetLength / 2);

    let snippet = content.slice(start, end);
    snippet = snippet.replace(/<[^>]*>/g, ''); // Strip HTML

    if (start > 0) {
      snippet = '...' + snippet;
    }
    if (end < content.length) {
      snippet = snippet + '...';
    }

    return snippet.trim();
  }

  /**
   * Generate snippet with query highlighting
   */
  private generateSnippet(content: string, query: string): string {
    const normalizedQuery = this.normalizeText(query);
    const terms = this.tokenize(normalizedQuery);

    if (terms.length === 0) {
      return content.slice(0, 200) + '...';
    }

    // Find first occurrence of any term
    let firstPos = content.length;
    for (const term of terms) {
      const pos = content.toLowerCase().indexOf(term);
      if (pos !== -1 && pos < firstPos) {
        firstPos = pos;
      }
    }

    return this.generateHighlight(content, firstPos);
  }

  /**
   * Rebuild index from articles
   */
  async rebuildIndex(articles: KnowledgeArticle[]): Promise<void> {
    await this.clearIndex();
    for (const article of articles) {
      await this.indexArticle(article);
    }
  }
}

// Export singleton instance
export const knowledgeSearch = new KnowledgeSearch();
