import { whitespaceTokenizer } from "..";

it(`should return one token when input doesn't have whitespaces`, () => {
  expect(whitespaceTokenizer("abc")).toEqual(["abc"]);
});

it(`should return two tokens when tokens separated with space`, () => {
  expect(whitespaceTokenizer("a b")).toEqual(["a", "b"]);
});

it(`should return two tokens when tokens separate with tab`, () => {
  expect(whitespaceTokenizer("a\tb")).toEqual(["a", "b"]);
});

it(`should return two tokens when tokens separate with newline`, () => {
  expect(whitespaceTokenizer("a\nb")).toEqual(["a", "b"]);
});
