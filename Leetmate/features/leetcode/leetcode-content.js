async function fetchAndSaveSubmissions() {
  const items = await new Promise((resolve) =>
    chrome.storage.local.get("leetcodeUsername", resolve)
  );
  const username = items?.leetcodeUsername;
  if (!username) {
    console.log("No LeetCode username cached. Open Leetmate Home to sync.");
    return;
  }

  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query recentSubmissions($username: String!) {
            recentSubmissionList(username: $username) {
              id
              title
              titleSlug
              timestamp
            }
          }
        `,
        variables: { username },
      }),
    });

    const data = await res.json();
    const submissions = data.data?.recentSubmissionList ?? [];

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });
    const todaySubmissions = submissions.filter((submission) => {
      const submissionDate = new Date(
        Number(submission.timestamp) * 1000
      ).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
      return submissionDate === today;
    });

    // Only store unique problems per day (dedupe by titleSlug).
    // recentSubmissionList is accepted-only, so resubmits shouldn't create extra rewards.
    const seen = new Set();
    const uniqueToday = [];
    for (const s of todaySubmissions) {
      const slug = s && s.titleSlug;
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      uniqueToday.push(s);
    }

    if (uniqueToday.length > 0) {
      chrome.runtime.sendMessage({
        type: "SAVE_LEETCODE_PROGRESS",
        payload: uniqueToday,
      });
    }
  } catch (err) {
    console.error("GraphQL failed:", err);
  }
}

// Run on initial load
fetchAndSaveSubmissions();

// Run again when background signals navigation (SPA route change)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "FETCH_SUBMISSIONS") {
    fetchAndSaveSubmissions();
  }
});