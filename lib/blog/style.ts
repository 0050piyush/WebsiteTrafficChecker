/**
 * House style rules every post is checked against (tests/blog.test.ts). The full
 * editorial guide is docs/newsroom.md.
 */

/** Filler and clichés that make writing read as generic. Matched case-insensitively. */
export const BANNED_PHRASES = [
  "in today's fast-paced",
  "in today's digital",
  "in the ever-evolving",
  "ever-changing landscape",
  "rapidly evolving landscape",
  "the world of tech",
  "delve",
  "game-changer",
  "game changer",
  "revolutionize",
  "unlock the power",
  "harness the power",
  "a testament to",
  "it's worth noting that",
  "it is worth noting",
  "it's important to note",
  "in conclusion",
  "to sum up",
  "in summary",
  "buckle up",
  "navigating the",
  "seamless",
  "cutting-edge",
  "paradigm shift",
  "tapestry",
  "embark on",
  "only time will tell",
  "stay tuned",
  "as an ai",
  "as a language model",
];

export const MIN_WORDS = 400;
export const MAX_WORDS = 1600;
export const MIN_SOURCES = 2;
