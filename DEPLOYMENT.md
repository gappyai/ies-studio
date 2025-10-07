# GitHub Pages Deployment Guide

This guide explains how to deploy your IES Studio React project to GitHub Pages.

## Setup Complete ✅

Your project has been configured for GitHub Pages deployment with:

1. **Base path configuration** in [`vite.config.ts`](vite.config.ts:7) - Set to `/ies-studio/` to match your repository name
2. **gh-pages package** installed for manual deployment
3. **Deploy scripts** added to [`package.json`](package.json:11-12)
4. **GitHub Actions workflow** created at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml:1) for automatic deployment

## Deployment Methods

### Method 1: Automatic Deployment (Recommended)

This method uses GitHub Actions to automatically deploy your site whenever you push to the main branch.

#### Enable GitHub Pages:

1. Go to your repository: https://github.com/gappyai/ies-studio
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. Save the settings

#### Deploy:

Simply push your changes to the main branch:

```bash
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

The GitHub Actions workflow will automatically:
- Build your project
- Deploy to GitHub Pages

Your site will be available at: **https://gappyai.github.io/ies-studio/**

### Method 2: Manual Deployment

You can also deploy manually using the gh-pages package:

```bash
npm run deploy
```

This command will:
1. Build your project (`npm run build`)
2. Deploy the `dist` folder to the `gh-pages` branch

**Note:** For manual deployment, you need to configure GitHub Pages to use the `gh-pages` branch:
1. Go to **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Select `gh-pages` branch and `/ (root)` folder
4. Save

## Viewing Your Site

After deployment, your site will be available at:

**https://gappyai.github.io/ies-studio/**

## Important Notes

- The base path `/ies-studio/` is configured in [`vite.config.ts`](vite.config.ts:7). This matches your repository name.
- If you rename your repository, update the `base` path in [`vite.config.ts`](vite.config.ts:7) accordingly.
- GitHub Actions requires Pages to be enabled and set to use **GitHub Actions** as the source.
- The first deployment may take a few minutes to become available.

## Troubleshooting

### Site not loading / 404 errors:
- Verify the `base` path in [`vite.config.ts`](vite.config.ts:7) matches your repository name
- Ensure GitHub Pages is enabled in repository settings
- Check the Actions tab for any deployment errors

### Manual deployment fails:
- Ensure you have committed all changes
- Check that you have write access to the repository
- Verify gh-pages package is installed: `npm list gh-pages`

### GitHub Actions workflow fails:
- Check the Actions tab for error details
- Ensure GitHub Pages is enabled with "GitHub Actions" as the source
- Verify the workflow has proper permissions in repository settings

## Next Steps

1. Commit and push the deployment configuration:
   ```bash
   git add .
   git commit -m "Add GitHub Pages deployment configuration"
   git push origin main
   ```

2. Enable GitHub Pages in repository settings (if using automatic deployment)

3. Wait for the GitHub Actions workflow to complete

4. Visit https://gappyai.github.io/ies-studio/ to see your deployed site!