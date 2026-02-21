const REPO_OWNER = 'DeepStackers-Bil496';
const REPO_NAME = 'multi-agent-ai-framework';

const issueData = {
  title: '[UX] Improve File Upload Preview in Chat Interface',
  body: `## Problem

Currently, when a user attaches a file in the chat interface, the preview is minimal and uninformative:
- Only shows a generic "File" label with a small icon
- No file name displayed
- No file size or type information
- Poor visual hierarchy and contrast

This makes it difficult for users to:
- Verify they uploaded the correct file
- Distinguish between multiple uploaded files
- Understand what data they're working with

## Current Implementation

The file preview appears to be rendered in the chat input area (\`components/multimodal-input.tsx\`) or attachment preview component (\`components/preview-attachment.tsx\`).

## Proposed Solution

Enhance the file upload preview to display:

### Visual Elements
1. **File Name** - Full filename prominently displayed
2. **File Size** - Human-readable size (e.g., "2.5 KB", "1.2 MB")
3. **File Type/Extension** - Either as badge or icon
4. **Preview Icon** - Type-specific icons (CSV, TXT, PDF, Image, etc.)
5. **Remove Button** - Clear X button to remove attachment

### Layout Improvements
\`\`\`
┌─────────────────────────────────────────────┐
│  📄  sales_data.csv                    ✕   │
│      2.5 KB • CSV                           │
└─────────────────────────────────────────────┘
\`\`\`

### Technical Details
- Add file metadata parsing in attachment handler
- Display filename from \`attachment.name\`
- Calculate file size from blob/buffer
- Use different icons based on MIME type
- Improve contrast and spacing
- Consider showing first few rows for CSV preview (optional)

## Affected Components
- \`components/multimodal-input.tsx\` - Main input with attachments
- \`components/preview-attachment.tsx\` - Attachment preview component
- \`components/message.tsx\` - Message display with attachments
- \`lib/types.ts\` - Attachment type definition

## Benefits
✅ Better UX - Users can see what they uploaded
✅ Error Prevention - Easy to spot wrong file before sending
✅ Professional appearance - More polished interface
✅ Accessibility - Better for screen readers with descriptive labels

## Priority
**Medium** - Affects user experience but not blocking functionality

## Related Work
- Similar to how Discord, Slack, and other chat apps show file previews
- Could be enhanced further with thumbnail previews for images
- CSV files could show column count preview

---
*Reported via automated script - see \`scripts/create_file_upload_issue.ts\`*`,
  labels: ['enhancement', 'UX', 'frontend']
};

async function createIssue() {
  console.log('🚀 Creating GitHub issue...\n');

  // Try environment variable first, then .env.local
  let token = process.env.GITHUB_PAT;
  
  if (!token) {
    try {
      const fs = await import('fs');
      const envContent = fs.readFileSync('.env.local', 'utf-8');
      const patMatch = envContent.match(/GITHUB_PAT=(.+)/);
      if (patMatch) {
        token = patMatch[1].trim();
      }
    } catch (error) {
      // .env.local doesn't exist or can't be read
    }
  }

  if (!token) {
    throw new Error('GITHUB_PAT not found. Set it as environment variable or in .env.local');
  }

  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
        'User-Agent': 'IssueCreatorScript/1.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issueData),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create issue: ${response.status} - ${JSON.stringify(error)}`);
  }

  const issue = await response.json();
  console.log(`✅ Issue created successfully!`);
  console.log(`📍 URL: ${issue.html_url}`);
  console.log(`🔢 Issue #${issue.number}`);
  console.log(`\n📝 Title: ${issue.title}`);
}

createIssue().catch(console.error);
