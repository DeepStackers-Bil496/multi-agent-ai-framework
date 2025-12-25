const REPO_OWNER = 'DeepStackers-Bil496';
const REPO_NAME = 'multi-agent-ai-framework';

async function fetchIssues() {
    console.log(`\n\x1b[36m🚀 Initializing GitHub Issue Fetcher for ${REPO_OWNER}/${REPO_NAME}...\x1b[0m`);

    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'IssueFetcherScript/2.0',
    };

    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&per_page=100&sort=created&direction=desc`,
            { headers }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
        }

        const allItems: any[] = await response.json();
        const issues = allItems.filter(item => !item.pull_request);

        if (issues.length === 0) {
            console.log('\x1b[35mNo issues found in this repository.\x1b[0m');
            return;
        }

        const openIssues = issues.filter(i => i.state === 'open');
        const closedIssues = issues.filter(i => i.state === 'closed');

        console.log(`\n\x1b[1m📊 SUMMARY: ${issues.length} Issues Found (${openIssues.length} Open, ${closedIssues.length} Closed)\x1b[0m`);
        console.log('\x1b[90m' + '='.repeat(80) + '\x1b[0m');

        const renderSection = (title: string, list: any[], color: string) => {
            if (list.length === 0) return;
            console.log(`\n${color}\x1b[1m=== ${title} (${list.length}) ===\x1b[0m`);

            list.forEach(issue => {
                const labels = issue.labels.map((l: any) => `[${l.name}]`).join(' ') || '';
                console.log(`\n${color}#${issue.number} \x1b[1m${issue.title}\x1b[0m ${labels}`);
                console.log(`\x1b[90mURL: ${issue.html_url}\x1b[0m`);

                if (issue.body) {
                    const bodyPreview = issue.body.length > 1000
                        ? issue.body.substring(0, 1000) + '...'
                        : issue.body;
                    console.log(`\x1b[37m\n${bodyPreview.split('\n').map((line: string) => `  ${line}`).join('\n')}\x1b[0m`);
                } else {
                    console.log(`\x1b[90m  (No description provided)\x1b[0m`);
                }
                console.log(`\x1b[90m${'-'.repeat(40)}\x1b[0m`);
            });
        };

        renderSection('OPEN ISSUES', openIssues, '\x1b[32m');
        renderSection('CLOSED ISSUES', closedIssues, '\x1b[31m');

        console.log(`\n\x1b[36m✨ Update complete at ${new Date().toLocaleString()}\x1b[0m\n`);
    } catch (error: any) {
        console.error(`\x1b[31m❌ Error: ${error.message}\x1b[0m`);
        process.exit(1);
    }
}

fetchIssues();
