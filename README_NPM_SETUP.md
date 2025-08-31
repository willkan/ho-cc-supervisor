# NPM Publishing Setup Guide

## Prerequisites

Before the GitHub Actions can publish to npm, you need to:

### 1. Create NPM Account (if you don't have one)
Visit https://www.npmjs.com/signup

### 2. Generate NPM Access Token
1. Log in to https://www.npmjs.com/
2. Click your profile icon → Access Tokens
3. Click "Generate New Token"
4. Choose "Automation" token type
5. Copy the generated token

### 3. Add NPM Token to GitHub Repository
1. Go to https://github.com/willkan/ho-cc-supervisor/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Paste your npm token
5. Click "Add secret"

## Publishing Workflow

### Automatic Publishing (via GitHub Release)
1. Go to https://github.com/willkan/ho-cc-supervisor/releases
2. Click "Create a new release"
3. Choose/create a tag (e.g., `v2.0.1`)
4. Fill in release title and notes
5. Click "Publish release"
6. GitHub Actions will automatically publish to npm

### Manual Publishing (via GitHub Actions)
1. Go to https://github.com/willkan/ho-cc-supervisor/actions
2. Click on "Publish to NPM" workflow
3. Click "Run workflow"
4. Enter version number (e.g., `2.0.1`)
5. Click "Run workflow"

### Local Publishing (if needed)
```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

## Verification

After publishing, verify the package at:
https://www.npmjs.com/package/@ho/cc-supervisor

## Testing Installation

```bash
# Install globally
npm install -g @ho/cc-supervisor

# Verify installation
cc-supervisor --version
cc-supervisor --help
```

## Troubleshooting

### Error: 402 Payment Required
- This means the @ho scope might require payment
- Consider using a different scope or unscoped name

### Error: 403 Forbidden
- Check if you have permission to publish to @ho scope
- Verify your NPM_TOKEN is correct

### Error: Package name too similar
- NPM might reject if name is too similar to existing packages
- Consider a more unique name if needed