---
description: How to deploy the Chinese Reader to Vercel via GitHub
---

# Deploying to Vercel via GitHub

This is the easiest way to deploy your app. Vercel will automatically build and deploy your site whenever you push to GitHub.

## Prerequisites
1.  You have a Vercel account (sign up at [vercel.com](https://vercel.com/signup) if you don't).
2.  You have pushed your code to GitHub (which we just did!).

## Steps

1.  **Log in to Vercel**: Go to [vercel.com/dashboard](https://vercel.com/dashboard) and log in.
2.  **Add New Project**:
    *   Click the **"Add New..."** button (usually top right).
    *   Select **"Project"**.
3.  **Import Git Repository**:
    *   You should see a list of your GitHub repositories on the left.
    *   Find `chinese-reader` and click **"Import"**.
    *   *Note: If you don't see your repo, click "Adjust GitHub App Permissions" link to grant Vercel access to it.*
4.  **Configure Project**:
    *   **Project Name**: Leave as `chinese-reader` or change it.
    *   **Framework Preset**: Vercel should automatically detect **"Vite"**. If not, select it.
    *   **Root Directory**: Leave as `./`.
    *   **Build & Development Settings**: The defaults should be correct (`vite build`, etc).
    *   **Environment Variables**: We don't have any secrets yet, so leave this empty.
5.  **Deploy**:
    *   Click the **"Deploy"** button.
    *   Wait for the build to complete (usually < 1 minute).

## Verify Deployment
Once the deployment screens shows "Congratulations!", click the screenshot to visit your live site.
Test that the routing works by:
1.  Navigation to the **Vocabulary** page.
2.  Refreshing the page (this tests the `vercel.json` rewrite rules).
