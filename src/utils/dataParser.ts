import { WordData, Word, MultiMeaningWord } from '../types';

export class DataParser {
  private wordData: WordData[] = [];
  private multiMeaningWords: MultiMeaningWord[] = [];

  async loadData(): Promise<void> {
    try {
      const response = await fetch('/kobun_q.jsonl.txt');
      const text = await response.text();
      const lines = text.trim().split('\n');

      this.wordData = lines
        .map(line => {
          try {
            const parsed = JSON.parse(line) as WordData;
            // Validate required properties
            if (!parsed || !parsed.lemma || !parsed.qid || !parsed.sense) {
              console.warn('Invalid word data found:', parsed);
              return null;
            }
            return parsed;
          } catch (parseError) {
            console.warn('Failed to parse line:', line, parseError);
            return null;
          }
        })
        .filter((word): word is WordData => word !== null);

      this.processMultiMeaningWords();
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  private processMultiMeaningWords(): void {
    const wordGroups = new Map<string, WordData[]>();

    // Group by lemma
    this.wordData.forEach(word => {
      // Additional defensive check during processing
      if (!word || !word.lemma || typeof word.lemma !== 'string') {
        console.warn('Skipping invalid word during processing:', word);
        return;
      }

      const existing = wordGroups.get(word.lemma) || [];
      existing.push(word);
      wordGroups.set(word.lemma, existing);
    });

    // Filter words with multiple meanings
    this.multiMeaningWords = Array.from(wordGroups.entries())
      .filter(([_, words]) => words.length > 1)
      .map(([lemma, words]) => {
        const meanings = words
          .filter(word => word && word.lemma && word.qid && word.sense)
          .map(word => ({
            qid: word.qid,
            lemma: word.lemma,
            sense: word.sense,
            meaning_idx: word.meaning_idx,
            group: parseInt(word.group) || 0,
            examples: word.examples || []
          }));

        return {
          lemma,
          meanings
        };
      });
  }

  getMultiMeaningWords(): MultiMeaningWord[] {
    return this.multiMeaningWords;
  }

  getRandomMultiMeaningWords(count: number): MultiMeaningWord[] {
    const shuffled = [...this.multiMeaningWords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  getWordByLemma(lemma: string): MultiMeaningWord | undefined {
    return this.multiMeaningWords.find(word => word.lemma === lemma);
  }

  getAllLemmas(): string[] {
    return this.multiMeaningWords.map(word => word.lemma);
  }

  getAllWords(): Word[] {
    return this.wordData
      .filter(word => word && word.lemma && word.qid && word.sense)
      .map(word => ({
        qid: word.qid,
        lemma: word.lemma,
        sense: word.sense,
        meaning_idx: word.meaning_idx,
        group: parseInt(word.group) || 0,
        examples: word.examples || []
      }));
  }
}

export const dataParser = new DataParser();
