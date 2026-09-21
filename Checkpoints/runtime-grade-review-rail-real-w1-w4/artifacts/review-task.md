Review the requested pull request(s) for worker session jarvis-upper-2.

Review task queue:
* 1. https://github.com/leviathan-devops/jarvis-upper/pull/1 (head commit fe79f99d22937a2ccca8bdcf5d2c445bb0a13d72, run e1cf3f32-141d-453c-8716-906a253d239b)


Complete every review task in the queue autonomously. Do not ask the user whether to continue to the next PR, and do not stop after the first PR unless the provider or checkout is genuinely unusable for every queued task.

Do these steps in order:
1. For each PR below, post a separate review on that pull request and capture its id in one call. Post with `gh api` rather than `gh pr review`: it is the only way to attach inline comments, and its response carries the created review's id, so AO can tell the worker exactly which review to address. Send the review as a JSON body so the inline comments form a proper array of objects:

    printf '%s' '{ "event": "COMMENT", "body": "<summary>", "comments": [ { "path": "<file>", "line": <n>, "body": "<finding>" } ] }' | gh api --method POST repos/{owner}/{repo}/pulls/{number}/reviews --input - --jq '.id'

   - Substitute the PR's owner/repo/number. Add one object to "comments" per inline finding; omit the field for a review with no inline comments.
	   - Keep the JSON on one line and shell-escape any single quotes in review text before passing it to printf; do not use a heredoc because reviewer panes run through an interactive PTY.
   - Always use "event": "COMMENT": reviews are posted from the PR author's own account, and GitHub rejects both APPROVE and REQUEST_CHANGES on your own PR. State in the body whether you are requesting changes or approving; the machine-readable verdict goes to AO in step 2.
   - The printed number is the review id. If the call fails on the provider, leave the id empty.
2. After every PR has its own GitHub review from step 1, record AO's bookkeeping for those already-posted reviews using one command. Pass JSON on stdin so nothing is ever written into the worktree (a file there could be committed onto the worker's branch). Include one object per PR/run from the queue:

    printf '%s' '{ "reviews": [ { "runId": "<run-id>", "verdict": "<approved|changes_requested>", "githubReviewId": "<id-from-step-1-or-empty>", "body": "<your full review markdown>" } ] }' | ao review submit --session jarvis-upper-2 --reviews -

Only if step 1 genuinely fails on the provider for a PR, still include that run in step 2 with an empty githubReviewId so the result is recorded.
