import { Index, createIndex, vacuumIndex, removeDocumentFromIndex, addDocumentToIndex } from "ndx";
import { expandTerm, query } from "ndx-query";

const WS_TOKENIZER_RE = /[\s]+/;

/**
 * The whitespace tokenizer breaks on whitespace - spaces, tabs, line feeds and assumes that contiguous nonwhitespace
 * characters form a single token.
 *
 * @param s Input string.
 * @returns Array of tokens.
 */
export function whitespaceTokenizer(s: string): string[] {
  return s.trim().split(WS_TOKENIZER_RE);
}

/**
 * Converts term to lower case.
 *
 * @param term Term.
 * @returns Filtered term.
 */
export function lowerCaseFilter(term: string): string {
  return term.toLowerCase();
}

const NW_FILTER_START_RE = /^\W+/;
const NW_FILTER_END_RE = /\W+$/;

/**
 * Removes all non-word characters at the start and at the end of the term.
 *
 * @param term Term.
 * @returns Filtered term.
 */
export function trimNonWordCharactersFilter(term: string): string {
  return term.replace(NW_FILTER_START_RE, "").replace(NW_FILTER_END_RE, "");
}

/**
 * Search Result.
 *
 * @typeparam I Document id.
 */
export interface SearchResult<I> {
  /**
   * Document key.
   */
  readonly docId: I;
  /**
   * Result score.
   */
  readonly score: number;
}

/**
 * BM25 Ranking function constants.
 */
export interface BM25Options {
  /**
   * Controls non-linear term frequency normalization (saturation).
   *
   * Default value: 1.2
   */
  readonly k1?: number;

  /**
   * Controls to what degree document length normalizes tf values.
   *
   * Default value: 0.75
   */
  readonly b?: number;
}

/**
 * Document Index options.
 */
export interface DocumentIndexOptions {
  /**
   * Tokenizer is a function that breaks a text into words, phrases, symbols, or other meaningful elements called
   * tokens.
   *
   * Default tokenizer breaks words on spaces, tabs, line feeds and assumes that contiguous nonwhitespace characters
   * form a single token.
   */
  readonly tokenizer?: (query: string) => string[];
  /**
   * Filter is a function that processes tokens and returns terms, terms are used in Inverted Index to index documents.
   *
   * Default filter transforms all characters to lower case and removes all non-word characters at the beginning and
   * the end of a term.
   */
  readonly filter?: (term: string) => string;
  /**
   * BM25 Ranking function constants.
   */
  readonly bm25?: BM25Options;
}

/**
 * Field Options.
 */
export interface FieldOptions<D> {
  /**
   * Getter is a function that will be used to get value for this field. If getter function isn't specified, field name
   * will be used to get value.
   */
  readonly getter?: (document: D) => string;
  /**
   * Score boosting factor.
   */
  readonly boost?: number;
}

export function DEFAULT_FILTER(term: string): string {
  return trimNonWordCharactersFilter(lowerCaseFilter(term));
}

export class DocumentIndex<I, D> {
  public readonly _index: Index<I>;
  public readonly _removed: Set<I>;
  private readonly _fieldsBoost: number[];
  private readonly _fieldsAccessors: Array<(doc: D) => string>;
  private readonly _tokenizer: (text: string) => string[];
  private readonly _filter: (term: string) => string;
  private readonly _bm25k1: number;
  private readonly _bm25b: number;

  constructor(options?: DocumentIndexOptions) {
    this._index = createIndex(0);
    this._removed = new Set<I>();
    this._fieldsBoost = [];
    this._fieldsAccessors = [];
    this._tokenizer = whitespaceTokenizer;
    this._filter = DEFAULT_FILTER;
    this._bm25k1 = 1.2;
    this._bm25b = 0.75;

    if (options !== void 0) {
      if (options.tokenizer !== void 0) {
        this._tokenizer = options.tokenizer;
      }
      if (options.filter !== void 0) {
        this._filter = options.filter;
      }
      const bm25 = options.bm25;
      if (bm25 !== void 0) {
        if (bm25.k1 !== void 0) {
          this._bm25k1 = bm25.k1;
        }
        if (bm25.b !== void 0) {
          this._bm25b = bm25.b;
        }
      }
    }
  }

  /**
   * Returns number of indexed document.
   */
  get size(): number {
    return this._index.docs.size;
  }

  /**
   * Create Field Index.
   */
  addField(fieldName: string, options?: FieldOptions<D>): void {
    let accessor: ((document: D) => string) | string = fieldName;
    let boost = 1;
    if (options !== void 0) {
      if (options.getter !== void 0) {
        accessor = options.getter;
      }
      if (options.boost !== void 0) {
        boost = options.boost;
      }
    }

    this._index.fields.push({ sum: 0, avg: 0 });
    this._fieldsBoost.push(boost);
    this._fieldsAccessors.push(
      typeof accessor === "string" ?
        (document: D) => (document as any as { [key: string]: string })[accessor as string] :
        accessor,
    );
  }

  /**
   * Add document to the index.
   */
  add(documentId: I, document: D): void {
    addDocumentToIndex(this._index, this._fieldsAccessors, this._tokenizer, this._filter, documentId, document);
  }

  /**
   * Remove document from the index.
   */
  remove(documentId: I): void {
    removeDocumentFromIndex(this._index, this._removed, documentId);
  }

  /**
   * Search with a free text query.
   *
   * All token separators work as a disjunction operator.
   */
  search(s: string): SearchResult<I>[] {
    return query(
      this._index,
      this._fieldsBoost,
      this._bm25k1,
      this._bm25b,
      this._tokenizer,
      this._filter,
      this._removed,
      s,
    ).map(({ key, score }) => ({ docId: key, score }));
  }

  /**
   * Expand term with all possible combinations.
   */
  expandTerm(term: string): string[] {
    return expandTerm(this._index, term);
  }

  /**
   * Convert query to an array of terms.
   */
  queryToTerms(s: string): string[] {
    let result = [] as string[];
    const tokens = this._tokenizer(s);
    for (let i = 0; i < tokens.length; i++) {
      const term = this._filter(tokens[i]);
      if (term !== "") {
        result = result.concat(expandTerm(this._index, term));
      }
    }

    return result;
  }

  /**
   * Clean up removed documents from the index.
   */
  vacuum(): void {
    vacuumIndex(this._index, this._removed);
  }
}
