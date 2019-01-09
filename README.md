# [ndx](https://github.com/ndx-compat/ndx-index) &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ndx-compat/ndx-index/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/ndx-index.svg)](https://www.npmjs.com/package/ndx-index) [![codecov](https://codecov.io/gh/ndx-compat/ndx-index/branch/master/graph/badge.svg)](https://codecov.io/gh/ndx-compat/ndx-index) [![CircleCI Status](https://circleci.com/gh/ndx-compat/ndx-index.svg?style=shield&circle-token=:circle-token)](https://circleci.com/gh/ndx-compat/ndx-index) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ndx-compat/ndx-index)

Backward-compatible API for [ndx](https://github.com/ndx-search/ndx) `< 0.6.0`.

## Documentation

- [Creating a new Document Index](#create_index)
- [Adding a text field to an index](#add_field)
- [Adding a document to an index](#add_doc)
- [Removing a document from an index](#remove_doc)
- [Search with a free text query](#search)
- [Extending a term](#extend_term)
- [Converting query to terms](#convert_query)
- [Vacuuming](#vacuum)

### <a name="create_index"></a>Creating a new Document Index

`DocumentIndex<I, D>(options?: DocumentIndexOptions)`

Document Index is a main object that stores all internal statistics and Inverted Index for documents.

#### Parametric Types

- `I` is a type of document IDs.
- `D` is a type of documents.

#### Options

```ts
/**
 * BM25 Ranking function constants.
 */
interface BM25Options {
  /**
   * Controls non-linear term frequency normalization (saturation).
   *
   * Default value: 1.2
   */
  k1?: number;

  /**
   * Controls to what degree document length normalizes tf values.
   *
   * Default value: 0.75
   */
  b?: number;
}

interface DocumentIndexOptions {
  /**
   * Tokenizer is a function that breaks a text into words, phrases, symbols, or other meaningful elements called
   * tokens.
   *
   * Default tokenizer breaks words on spaces, tabs, line feeds and assumes that contiguous nonwhitespace characters
   * form a single token.
   */
  tokenizer?: (query: string) => string[];
  /**
   * Filter is a function that processes tokens and returns terms, terms are used in Inverted Index to index documents.
   *
   * Default filter transforms all characters to lower case and removes all non-word characters at the beginning and
   * the end of a term.
   */
  filter?: (term: string) => string;
  /**
   * BM25 Ranking function constants.
   */
  bm25?: BM25Options;
}
```

#### Example

```js
/**
 * Creating a simple index with default options.
 */
const default = new DocumentIndex();

/**
 * Creating an index with changed BM25 constants.
 */
const index = new DocumentIndex({
  bm25: {
    k1: 1.3,
    b: 0.8,
  },
});
```

### <a name="add_field"></a>Adding a text field to an index

`addField(fieldName: string, options?: FieldOptions) => void`

The first step after creating a document index should be registering all text fields. Document Index is indexing only
registered text fields in documents.

Each field can have its own score boosting factor, score boosting factor will be used to boost score when ranking
documents.

#### Options

```ts
interface FieldOptions<D> {
  /**
   * Getter is a function that will be used to get value for this field. If getter function isn't specified, field name
   * will be used to get value.
   */
  getter: (doc: D) => string;

  /**
   * Score boosting factor.
   */
  boost: number;
}
```

#### Example

```js
const index = new DocumentIndex();

/**
 * Add a "title" field with a score boosting factor "1.4".
 */
index.addField("title", { boost: 1.4 });

/**
 * Add a "descriptionr" field.
 */
index.addField("description");

/**
 * Add a "body" field with a custom getter.
 */
index.addField("body", { getter: (doc) => doc.body });
```

### <a name="add_doc"></a>Adding a document to an index

When all fields are registered, tokenizer and filter is set, Document Index is ready to index documents.

Document Index doesn't store documents internally to reduce memory footprint, all results will contain a `docId` that is
associated with an added document.

`add(docId: I, document: D) => void`

#### Example

```js
const index = new DocumentIndex();

/**
 * Add a "content" field.
 */
index.addField("content");

const doc = {
  "id": "12345",
  "content": "Lorem ipsum",
};

/**
 * Add a document with `doc.id` to an index.
 */
index.add(doc.id, doc);
```

### <a name="remove_doc"></a>Removing a document from an index

Remove method requires to know just document id to remove it from an index. When document is removed from an index, it
is actually marked as removed, and when searching all removed documents will be ignored. `vacuum()` method is used to
completely remove all data from an index.

`remove(docId: I) => void`

#### Example

```js
const index = new DocumentIndex();

/**
 * Add a "content" field.
 */
index.addField("content");

const doc = {
  "id": "12345",
  "content": "Lorem ipsum",
};

/**
 * Add a document with `doc.id` to an index.
 */
index.add(doc.id, doc);

/**
 * Remove a document from an index.
 */
index.remove(doc.id);
```

### <a name="search"></a>Search with a free text query

Perform a search query with a free text, query will be preprocessed in the same way as all text fields with a registered
tokenizer and filter. Each token separator will work as a disjunction operator. All terms will be expanded to find more
documents, documents with expanded terms will have a lower score than documents with exact terms.

`search(query: string) => SearchResult[]`

```ts
interface SearchResult<I> {
  docId: I;
  score: number;
}
```

#### Example

```js
const index = new DocumentIndex();

/**
 * Add a "content" field.
 */
index.addField("content");

const doc1 = {
  "id": "1",
  "content": "Lorem ipsum dolor",
};
const doc2 = {
  "id": "2",
  "content": "Lorem ipsum",
};

/**
 * Add two documents to an index.
 */
index.add(doc1.id, doc1);
index.add(doc2.id, doc2);

/**
 * Perform a search query.
 */
index.search("Lorem");
// => [{ docId: "2" , score: ... }, { docId: "1", score: ... } ]
//
// document with an id `"2"` is ranked higher because it has a `"content"` field with a less number of terms than
// document with an id `"1"`.

index.search("dolor");
// => [{ docId: "1" }]
```

### <a name="extend_term"></a>Extending a term

Extend a term with all possible combinations starting from a `term` that is registered in an index.

`extendTerm(term: string) => string[]`

#### Example

```js
const index = new DocumentIndex();

index.addField("content");

const doc1 = {
  "id": "1",
  "content": "abc abcde",
};
const doc2 = {
  "id": "2",
  "content": "ab de",
};

index.add(doc1.id, doc1);
index.add(doc2.id, doc2);

/**
 * Extend a term with all possible combinations starting from `"a"`.
 */
index.extendTerm("a");
// => ["ab", "abc", "abcde"]

index.extendTerm("abc");
// => ["abc", "abcde"]

index.extendTerm("de");
// => ["de"]
```

### <a name="convert_query"></a>Converting query to terms

Convert a query to an array of terms with the same tokenizer and filters that are used in a DocumentIndex.

Converting queries are useful for implementing search highlighting feature.

`queryToTerms(query: string) => string[]`

#### Example

```js
const index = new DocumentIndex();

index.addField("content");

const doc1 = {
  "id": "1",
  "content": "abc abcde",
};
const doc2 = {
  "id": "2",
  "content": "ab de",
};

index.add(doc1.id, doc1);
index.add(doc2.id, doc2);

/**
 * Convert a query to an array of terms.
 */
index.queryToTerms("a d");
// => ["ab", "abc", "abcde", "de"]
```

#### Custom indexing options

The library doesn't serialize functions. So if you use custom `tokenizer`, `filter`, `field.getter` functions, then you will need to pass these functions to `deserialize` function call. See example in [src/__tests__/serialization.spec.ts](src/__tests__/serialization.spec.ts) test file. 

### <a name="vacuum"></a>Vacuuming

Vacuuming is a process that will remove all outdated documents from an inverted index.

When search is performed, all outdated documents will be automatically removed for all terms generated from a search
query.

`vacuum() => void`

#### Example

```js
const index = new DocumentIndex();

index.addField("content");

const doc = {
  "id": "12345",
  "content": "Lorem ipsum",
};

index.add(doc.id, doc);
index.remove(doc.id);

/**
 * Perform a vacuuming, it will remove all removed documents from an Inverted Index.
 */
index.vacuum();
```
