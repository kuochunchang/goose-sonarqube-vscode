/**
 * DiffParser Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DiffParser } from "../DiffParser.js";
import type { GitChanges, GitFileChange } from "../../types/git.types.js";

describe("DiffParser", () => {
  let parser: DiffParser;

  beforeEach(() => {
    parser = new DiffParser();
  });

  describe("parseGitChanges", () => {
    it("should parse git changes into structured format", () => {
      const changes: GitChanges = {
        summary: {
          filesChanged: 2,
          insertions: 10,
          deletions: 5,
        },
        files: [
          {
            path: "src/file1.ts",
            status: "modified",
            linesAdded: 10,
            linesDeleted: 5,
          },
          {
            path: "src/file2.ts",
            status: "added",
            linesAdded: 5,
            linesDeleted: 0,
          },
        ],
        diff: `diff --git a/src/file1.ts b/src/file1.ts
index 123..456 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,4 @@
 line1
+new line
 line2
`,
      };

      const parsed = parser.parseGitChanges(changes);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].file).toBe("src/file1.ts");
      expect(parsed[0].changeType).toBe("modified");
      expect(parsed[1].file).toBe("src/file2.ts");
      expect(parsed[1].changeType).toBe("added");
    });

    it("should handle empty changes", () => {
      const changes: GitChanges = {
        summary: {
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        },
        files: [],
        diff: "",
      };

      const parsed = parser.parseGitChanges(changes);
      expect(parsed).toHaveLength(0);
    });

    it("should handle renamed files", () => {
      const changes: GitChanges = {
        summary: {
          filesChanged: 1,
          insertions: 0,
          deletions: 0,
        },
        files: [
          {
            path: "src/new-file.ts",
            status: "renamed",
            linesAdded: 0,
            linesDeleted: 0,
            oldPath: "src/old-file.ts",
          },
        ],
        diff: `diff --git a/src/old-file.ts b/src/new-file.ts
rename from src/old-file.ts
rename to src/new-file.ts
`,
      };

      const parsed = parser.parseGitChanges(changes);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].changeType).toBe("renamed");
      expect(parsed[0].oldPath).toBe("src/old-file.ts");
    });
  });

  describe("extractFileDiffs", () => {
    it("should extract individual file diffs from full diff", () => {
      const fullDiff = `diff --git a/src/file1.ts b/src/file1.ts
index 123..456 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,4 @@
 line1
+new line
 line2

diff --git a/src/file2.ts b/src/file2.ts
index 789..abc 100644
--- a/src/file2.ts
+++ b/src/file2.ts
@@ -1,2 +1,3 @@
 line1
+another line
`;

      const fileDiffs = (parser as any).extractFileDiffs(fullDiff);
      expect(fileDiffs.size).toBe(2);
      expect(fileDiffs.has("src/file1.ts")).toBe(true);
      expect(fileDiffs.has("src/file2.ts")).toBe(true);
    });

    it("should handle empty diff", () => {
      const fileDiffs = (parser as any).extractFileDiffs("");
      expect(fileDiffs.size).toBe(0);
    });

    it("should handle single file diff", () => {
      const fullDiff = `diff --git a/src/file1.ts b/src/file1.ts
index 123..456 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,4 @@
 line1
+new line
`;

      const fileDiffs = (parser as any).extractFileDiffs(fullDiff);
      expect(fileDiffs.size).toBe(1);
      expect(fileDiffs.has("src/file1.ts")).toBe(true);
    });
  });

  describe("detectChangeType", () => {
    it("should detect added files", () => {
      const fileChange: GitFileChange = {
        path: "src/new-file.ts",
        status: "added",
        linesAdded: 10,
        linesDeleted: 0,
      };
      const changeType = (parser as any).detectChangeType(fileChange);
      expect(changeType).toBe("added");
    });

    it("should detect untracked files as added", () => {
      const fileChange: GitFileChange = {
        path: "src/new-file.ts",
        status: "untracked",
        linesAdded: 10,
        linesDeleted: 0,
      };
      const changeType = (parser as any).detectChangeType(fileChange);
      expect(changeType).toBe("added");
    });

    it("should detect deleted files", () => {
      const fileChange: GitFileChange = {
        path: "src/old-file.ts",
        status: "deleted",
        linesAdded: 0,
        linesDeleted: 10,
      };
      const changeType = (parser as any).detectChangeType(fileChange);
      expect(changeType).toBe("deleted");
    });

    it("should detect renamed files", () => {
      const fileChange: GitFileChange = {
        path: "src/new-file.ts",
        status: "renamed",
        linesAdded: 0,
        linesDeleted: 0,
        oldPath: "src/old-file.ts",
      };
      const changeType = (parser as any).detectChangeType(fileChange);
      expect(changeType).toBe("renamed");
    });

    it("should default to modified for other statuses", () => {
      const fileChange: GitFileChange = {
        path: "src/file.ts",
        status: "modified",
        linesAdded: 5,
        linesDeleted: 3,
      };
      const changeType = (parser as any).detectChangeType(fileChange);
      expect(changeType).toBe("modified");
    });
  });

  describe("extractExtension", () => {
    it("should extract file extension", () => {
      const extension = (parser as any).extractExtension("src/file.ts");
      expect(extension).toBe("ts");
    });

    it("should handle files without extension", () => {
      const extension = (parser as any).extractExtension("src/file");
      expect(extension).toBe("");
    });

    it("should handle files with multiple dots", () => {
      const extension = (parser as any).extractExtension("src/file.test.ts");
      expect(extension).toBe("ts");
    });

    it("should handle hidden files", () => {
      const extension = (parser as any).extractExtension(".gitignore");
      expect(extension).toBe("gitignore");
    });
  });

  describe("formatDiffForAnalysis", () => {
    it("should format diff with metadata", () => {
      const parsedChange = {
        file: "src/file.ts",
        changeType: "modified" as const,
        diff: "diff content",
        additions: 10,
        deletions: 5,
        extension: "ts",
        complexity: 15,
      };

      const formatted = parser.formatDiffForAnalysis(parsedChange);
      expect(formatted).toContain("File: src/file.ts");
      expect(formatted).toContain("Change Type: modified");
      expect(formatted).toContain("Language: TypeScript");
      expect(formatted).toContain("Changes: +10 -5");
    });

    it("should format diff without metadata", () => {
      const parsedChange = {
        file: "src/file.ts",
        changeType: "modified" as const,
        diff: "diff content",
        additions: 10,
        deletions: 5,
        extension: "ts",
        complexity: 15,
      };

      const formatted = parser.formatDiffForAnalysis(parsedChange, {
        includeMetadata: false,
      });
      expect(formatted).not.toContain("File:");
      expect(formatted).toContain("diff content");
    });

    it("should include old path for renamed files", () => {
      const parsedChange = {
        file: "src/new-file.ts",
        changeType: "renamed" as const,
        oldPath: "src/old-file.ts",
        diff: "diff content",
        additions: 0,
        deletions: 0,
        extension: "ts",
        complexity: 0,
      };

      const formatted = parser.formatDiffForAnalysis(parsedChange);
      expect(formatted).toContain("Old Path: src/old-file.ts");
    });
  });

  describe("getLanguageFromExtension", () => {
    it("should map common extensions to languages", () => {
      const testCases = [
        { ext: "ts", lang: "TypeScript" },
        { ext: "js", lang: "JavaScript" },
        { ext: "py", lang: "Python" },
        { ext: "java", lang: "Java" },
        { ext: "go", lang: "Go" },
        { ext: "rs", lang: "Rust" },
      ];

      testCases.forEach(({ ext, lang }) => {
        const result = (parser as any).getLanguageFromExtension(ext);
        expect(result).toBe(lang);
      });
    });

    it("should handle unknown extensions", () => {
      const result = (parser as any).getLanguageFromExtension("xyz");
      expect(result).toBe("Unknown");
    });

    it("should be case insensitive", () => {
      const result1 = (parser as any).getLanguageFromExtension("TS");
      const result2 = (parser as any).getLanguageFromExtension("ts");
      expect(result1).toBe(result2);
    });
  });

  describe("groupByExtension", () => {
    it("should group files by extension", () => {
      const parsedChanges = [
        {
          file: "src/file1.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 5,
          deletions: 3,
          extension: "ts",
          complexity: 8,
        },
        {
          file: "src/file2.ts",
          changeType: "added" as const,
          diff: "",
          additions: 10,
          deletions: 0,
          extension: "ts",
          complexity: 10,
        },
        {
          file: "src/file.js",
          changeType: "modified" as const,
          diff: "",
          additions: 2,
          deletions: 1,
          extension: "js",
          complexity: 3,
        },
      ];

      const groups = parser.groupByExtension(parsedChanges);
      expect(groups.size).toBe(2);
      expect(groups.get("ts")).toHaveLength(2);
      expect(groups.get("js")).toHaveLength(1);
    });

    it("should handle files without extension", () => {
      const parsedChanges = [
        {
          file: "src/file",
          changeType: "modified" as const,
          diff: "",
          additions: 5,
          deletions: 3,
          extension: "",
          complexity: 8,
        },
      ];

      const groups = parser.groupByExtension(parsedChanges);
      expect(groups.get("unknown")).toHaveLength(1);
    });
  });

  describe("sortByComplexity", () => {
    it("should sort files by complexity (most complex first)", () => {
      const parsedChanges = [
        {
          file: "src/file1.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 5,
          deletions: 3,
          extension: "ts",
          complexity: 8,
        },
        {
          file: "src/file2.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 20,
          deletions: 10,
          extension: "ts",
          complexity: 30,
        },
        {
          file: "src/file3.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 2,
          deletions: 1,
          extension: "ts",
          complexity: 3,
        },
      ];

      const sorted = parser.sortByComplexity(parsedChanges);
      expect(sorted[0].complexity).toBe(30);
      expect(sorted[1].complexity).toBe(8);
      expect(sorted[2].complexity).toBe(3);
    });
  });

  describe("filterByChangeType", () => {
    it("should filter files by change type", () => {
      const parsedChanges = [
        {
          file: "src/file1.ts",
          changeType: "added" as const,
          diff: "",
          additions: 10,
          deletions: 0,
          extension: "ts",
          complexity: 10,
        },
        {
          file: "src/file2.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 5,
          deletions: 3,
          extension: "ts",
          complexity: 8,
        },
        {
          file: "src/file3.ts",
          changeType: "deleted" as const,
          diff: "",
          additions: 0,
          deletions: 5,
          extension: "ts",
          complexity: 5,
        },
      ];

      const filtered = parser.filterByChangeType(parsedChanges, ["added", "modified"]);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].changeType).toBe("added");
      expect(filtered[1].changeType).toBe("modified");
    });
  });

  describe("filterByExtension", () => {
    it("should filter files by extension", () => {
      const parsedChanges = [
        {
          file: "src/file1.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 5,
          deletions: 3,
          extension: "ts",
          complexity: 8,
        },
        {
          file: "src/file2.js",
          changeType: "modified" as const,
          diff: "",
          additions: 2,
          deletions: 1,
          extension: "js",
          complexity: 3,
        },
        {
          file: "src/file3.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 3,
          deletions: 2,
          extension: "ts",
          complexity: 5,
        },
      ];

      const filtered = parser.filterByExtension(parsedChanges, ["ts"]);
      expect(filtered).toHaveLength(2);
      filtered.forEach((change) => {
        expect(change.extension).toBe("ts");
      });
    });

    it("should be case insensitive", () => {
      const parsedChanges = [
        {
          file: "src/file1.TS",
          changeType: "modified" as const,
          diff: "",
          additions: 5,
          deletions: 3,
          extension: "TS",
          complexity: 8,
        },
      ];

      const filtered = parser.filterByExtension(parsedChanges, ["ts"]);
      expect(filtered).toHaveLength(1);
    });
  });

  describe("createSummary", () => {
    it("should create summary statistics", () => {
      const parsedChanges = [
        {
          file: "src/file1.ts",
          changeType: "added" as const,
          diff: "",
          additions: 10,
          deletions: 0,
          extension: "ts",
          complexity: 10,
        },
        {
          file: "src/file2.ts",
          changeType: "modified" as const,
          diff: "",
          additions: 5,
          deletions: 3,
          extension: "ts",
          complexity: 8,
        },
        {
          file: "src/file3.js",
          changeType: "deleted" as const,
          diff: "",
          additions: 0,
          deletions: 5,
          extension: "js",
          complexity: 5,
        },
      ];

      const summary = parser.createSummary(parsedChanges);
      expect(summary.totalFiles).toBe(3);
      expect(summary.totalAdditions).toBe(15);
      expect(summary.totalDeletions).toBe(8);
      expect(summary.byChangeType.added).toBe(1);
      expect(summary.byChangeType.modified).toBe(1);
      expect(summary.byChangeType.deleted).toBe(1);
      expect(summary.byExtension.ts).toBe(2);
      expect(summary.byExtension.js).toBe(1);
      expect(summary.mostComplexFile?.file).toBe("src/file1.ts");
    });

    it("should handle empty array", () => {
      const summary = parser.createSummary([]);
      expect(summary.totalFiles).toBe(0);
      expect(summary.totalAdditions).toBe(0);
      expect(summary.totalDeletions).toBe(0);
      expect(summary.mostComplexFile).toBeNull();
    });
  });
});
