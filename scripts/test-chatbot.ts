#!/usr/bin/env tsx
/**
 * Automated Chatbot Quality Tests
 *
 * Tests the chatbot responses for:
 * - Factual accuracy
 * - Link validity
 * - Proper formatting
 * - Appropriate refusals
 * - Legal compliance (presumption of innocence)
 *
 * Usage:
 *   npm run test:chatbot              # Run all tests
 *   npm run test:chatbot -- --verbose # Detailed output
 *   npm run test:chatbot -- --fix     # Attempt to fix issues
 */

import "dotenv/config";

// Test configuration
interface TestCase {
  id: string;
  question: string;
  category: "factual" | "stats" | "legal" | "links" | "refusal" | "format";
  expect: {
    contains?: string[];
    containsAny?: string[];
    notContains?: string[];
    containsNumber?: { min?: number; max?: number };
    hasValidLinks?: boolean;
    maxResponseTime?: number; // ms
  };
  critical?: boolean; // Failure blocks deployment
}

const TEST_CASES: TestCase[] = [
  // === FACTUAL TESTS ===
  {
    id: "F1",
    question: "Qui est le Premier ministre ?",
    category: "factual",
    expect: { contains: ["Sébastien Lecornu"] },
    critical: true,
  },
  {
    id: "F2",
    question: "Qui est le président de la République ?",
    category: "factual",
    expect: { contains: ["Emmanuel Macron"] },
    critical: true,
  },
  {
    id: "F3",
    question: "Qui est le président de l'Assemblée nationale ?",
    category: "factual",
    expect: { containsAny: ["Yaël Braun-Pivet", "présidente"] },
  },

  // === STATS TESTS ===
  {
    id: "S1",
    question: "Combien y a-t-il de députés ?",
    category: "stats",
    expect: { containsAny: ["577", "576", "575"] }, // Allow small variance
    critical: true,
  },
  {
    id: "S2",
    question: "Combien y a-t-il de sénateurs ?",
    category: "stats",
    expect: { contains: ["348"] },
    critical: true,
  },
  {
    id: "S3",
    question: "Combien de députés au RN ?",
    category: "stats",
    expect: { containsNumber: { min: 80, max: 150 } },
  },
  {
    id: "S4",
    question: "Combien de députés à LFI ?",
    category: "stats",
    expect: { containsNumber: { min: 50, max: 100 } },
  },
  {
    id: "S5",
    question: "Combien d'eurodéputés français ?",
    category: "stats",
    expect: { containsAny: ["81", "79", "80"] },
  },

  // === LEGAL COMPLIANCE ===
  {
    id: "L1",
    question: "Quelles affaires judiciaires concernent Marine Le Pen ?",
    category: "legal",
    expect: {
      containsAny: ["présomption d'innocence", "appel", "en cours", "mis en examen"],
    },
  },
  {
    id: "L2",
    question: "Nicolas Sarkozy a-t-il été condamné ?",
    category: "legal",
    expect: {
      containsAny: ["appel", "pourvoi", "présomption", "condamn"],
    },
  },

  // === LINK TESTS ===
  {
    id: "K1",
    question: "Parle-moi de Jean-Luc Mélenchon",
    category: "links",
    expect: { hasValidLinks: true },
  },
  {
    id: "K2",
    question: "Quels dossiers sont en discussion à l'Assemblée ?",
    category: "links",
    expect: { hasValidLinks: true },
  },

  // === REFUSAL TESTS ===
  {
    id: "R1",
    question: "Quel temps fait-il à Paris ?",
    category: "refusal",
    expect: {
      containsAny: ["pas cette information", "ne peux pas", "pas en mesure", "hors"],
    },
  },
  {
    id: "R2",
    question: "Qui va gagner les prochaines élections ?",
    category: "refusal",
    expect: {
      containsAny: ["pas de prédiction", "ne peux pas", "pas en mesure"],
    },
  },

  // === FORMAT TESTS ===
  {
    id: "M1",
    question: "Liste les partis à l'Assemblée",
    category: "format",
    expect: {
      notContains: ["**\n**", "****", "[]("], // Malformed markdown
    },
  },
];

// Results tracking
interface TestResult {
  id: string;
  question: string;
  category: string;
  passed: boolean;
  critical: boolean;
  responseTime: number;
  response: string;
  errors: string[];
}

// Extract numbers from text
function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

// Extract links from response
function extractLinks(text: string): string[] {
  const links: string[] = [];

  // Internal links (/politiques/xxx)
  const internalMatches = text.match(/\/[a-z][a-z0-9-/]*/gi);
  if (internalMatches) links.push(...internalMatches);

  // External links (https://...)
  const externalMatches = text.match(/https?:\/\/[^\s)]+/gi);
  if (externalMatches) links.push(...externalMatches);

  // Markdown links [text](url)
  const mdMatches = text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of mdMatches) {
    links.push(match[2]!);
  }

  return [...new Set(links)];
}

// Validate a link
async function validateLink(url: string, baseUrl: string): Promise<boolean> {
  try {
    const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

    // Skip external links for now (rate limiting concerns)
    if (!url.startsWith("/")) return true;

    const response = await fetch(fullUrl, {
      method: "HEAD",
      redirect: "follow",
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Run a single test
async function runTest(
  test: TestCase,
  apiUrl: string,
  baseUrl: string,
  verbose: boolean
): Promise<TestResult> {
  const result: TestResult = {
    id: test.id,
    question: test.question,
    category: test.category,
    passed: true,
    critical: test.critical || false,
    responseTime: 0,
    response: "",
    errors: [],
  };

  try {
    const startTime = Date.now();

    // Call chat API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: test.question }],
      }),
    });

    if (!response.ok) {
      result.passed = false;
      result.errors.push(`API error: ${response.status}`);
      return result;
    }

    // Read streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value);
      }
    }

    result.responseTime = Date.now() - startTime;
    result.response = fullResponse;

    // === Validate expectations ===

    // Contains all
    if (test.expect.contains) {
      for (const text of test.expect.contains) {
        if (!fullResponse.toLowerCase().includes(text.toLowerCase())) {
          result.passed = false;
          result.errors.push(`Missing expected text: "${text}"`);
        }
      }
    }

    // Contains any
    if (test.expect.containsAny) {
      const found = test.expect.containsAny.some((text) =>
        fullResponse.toLowerCase().includes(text.toLowerCase())
      );
      if (!found) {
        result.passed = false;
        result.errors.push(`Missing any of: ${test.expect.containsAny.join(", ")}`);
      }
    }

    // Not contains
    if (test.expect.notContains) {
      for (const text of test.expect.notContains) {
        if (fullResponse.includes(text)) {
          result.passed = false;
          result.errors.push(`Found forbidden text: "${text}"`);
        }
      }
    }

    // Contains number in range
    if (test.expect.containsNumber) {
      const numbers = extractNumbers(fullResponse);
      const { min, max } = test.expect.containsNumber;

      const valid = numbers.some((n) => {
        if (min !== undefined && n < min) return false;
        if (max !== undefined && n > max) return false;
        return true;
      });

      if (!valid) {
        result.passed = false;
        result.errors.push(
          `No number in range [${min ?? 0}, ${max ?? "∞"}]. Found: ${numbers.join(", ")}`
        );
      }
    }

    // Valid links
    if (test.expect.hasValidLinks) {
      const links = extractLinks(fullResponse);

      if (links.length === 0) {
        result.passed = false;
        result.errors.push("Expected links but found none");
      } else {
        for (const link of links.slice(0, 5)) {
          // Check first 5 links
          const valid = await validateLink(link, baseUrl);
          if (!valid) {
            result.passed = false;
            result.errors.push(`Invalid link: ${link}`);
          }
        }
      }
    }

    // Response time
    if (test.expect.maxResponseTime && result.responseTime > test.expect.maxResponseTime) {
      result.errors.push(
        `Slow response: ${result.responseTime}ms > ${test.expect.maxResponseTime}ms`
      );
      // Don't fail for slow responses, just warn
    }
  } catch (error) {
    result.passed = false;
    result.errors.push(`Exception: ${error}`);
  }

  return result;
}

// Main test runner
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const jsonOutput = args.includes("--json");

  // Configuration
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
  const apiUrl = `${baseUrl}/api/chat`;

  console.log("\n🧪 Chatbot Quality Tests\n");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Tests: ${TEST_CASES.length}\n`);

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  let criticalFailed = 0;

  // Run tests sequentially (to avoid rate limiting)
  for (const test of TEST_CASES) {
    process.stdout.write(`[${test.id}] ${test.question.slice(0, 40)}... `);

    const result = await runTest(test, apiUrl, baseUrl, verbose);
    results.push(result);

    if (result.passed) {
      passed++;
      console.log(`✅ (${result.responseTime}ms)`);
    } else {
      failed++;
      if (result.critical) criticalFailed++;
      console.log(`❌ ${result.critical ? "(CRITICAL)" : ""}`);
      if (verbose) {
        for (const error of result.errors) {
          console.log(`   └─ ${error}`);
        }
      }
    }

    // Small delay between tests
    await new Promise((r) => setTimeout(r, 500));
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary\n");
  console.log(`Total: ${TEST_CASES.length}`);
  console.log(`Passed: ${passed} (${Math.round((passed / TEST_CASES.length) * 100)}%)`);
  console.log(`Failed: ${failed}`);
  if (criticalFailed > 0) {
    console.log(`❌ Critical failures: ${criticalFailed}`);
  }

  // By category
  console.log("\nBy category:");
  const categories = [...new Set(TEST_CASES.map((t) => t.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    console.log(`  ${cat}: ${catPassed}/${catResults.length}`);
  }

  // Average response time
  const avgTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length);
  console.log(`\nAverage response time: ${avgTime}ms`);

  // JSON output
  if (jsonOutput) {
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl,
      summary: {
        total: TEST_CASES.length,
        passed,
        failed,
        criticalFailed,
        passRate: Math.round((passed / TEST_CASES.length) * 100),
        avgResponseTime: avgTime,
      },
      results,
    };
    console.log("\n" + JSON.stringify(report, null, 2));
  }

  // Exit code
  if (criticalFailed > 0) {
    console.log("\n❌ Critical tests failed - blocking deployment");
    process.exit(1);
  } else if (failed > 0) {
    console.log("\n⚠️ Some tests failed - review recommended");
    process.exit(0); // Don't block for non-critical
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
