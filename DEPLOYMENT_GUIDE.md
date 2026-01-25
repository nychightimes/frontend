# Google Cloud Run Deployment Guide

This guide provides step-by-step instructions for deploying the Next.js frontend application to Google Cloud Run with automated GitHub CI/CD.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Environment Variables](#environment-variables)
- [GitHub Integration](#github-integration)
- [Deployment](#deployment)
- [Custom Domain (Optional)](#custom-domain-optional)
- [Local Testing](#local-testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

1. **Google Cloud Account** - [Sign up here](https://cloud.google.com/)
2. **GCP Project** - Create a new project or use an existing one
3. **gcloud CLI** - [Install instructions](https://cloud.google.com/sdk/docs/install)
4. **Docker** (for local testing) - [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
5. **GitHub Account** - Repository must be pushed to GitHub
6. **Billing Enabled** - Cloud Run requires billing to be enabled on your GCP project

---

## Initial Setup

### 1. Install and Configure gcloud CLI

```bash
# Install gcloud CLI (if not already installed)
# Follow: https://cloud.google.com/sdk/docs/install

# Initialize gcloud
gcloud init

# Login to your Google account
gcloud auth login

# Set your project ID (replace YOUR_PROJECT_ID)
gcloud config set project YOUR_PROJECT_ID

# Verify configuration
gcloud config list
```

### 2. Enable Required APIs

```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Enable Cloud Build API (for CI/CD)
gcloud services enable cloudbuild.googleapis.com

# Enable Container Registry API
gcloud services enable containerregistry.googleapis.com

# Enable Artifact Registry API (recommended for newer projects)
gcloud services enable artifactregistry.googleapis.com
```

### 3. Set IAM Permissions

Ensure the Cloud Build service account has the necessary permissions:

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# Grant Cloud Run Admin role to Cloud Build
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
  --role=roles/run.admin

# Grant Service Account User role to Cloud Build
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
  --role=roles/iam.serviceAccountUser
```

---

## Environment Variables

### Required Environment Variables

Before deploying, ensure you have all environment variables ready. Common variables for this application include:

- `DATABASE_URL` - MySQL connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `NEXTAUTH_URL` - Your Cloud Run URL (we'll set this after first deployment)
- API keys for third-party services (Twilio, Brevo, Google Maps, etc.)

### Setting Environment Variables in Cloud Run

You can set environment variables during deployment or via the console:

#### Option 1: Via gcloud CLI

```bash
gcloud run services update frontend \
  --region=us-central1 \
  --update-env-vars="DATABASE_URL=your_database_url,NEXTAUTH_SECRET=your_secret"
```

#### Option 2: Via Google Cloud Console

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on your service (`frontend`)
3. Click "EDIT & DEPLOY NEW REVISION"
4. Scroll to "Container, Variables & Secrets"
5. Click "VARIABLES & SECRETS" tab
6. Add environment variables one by one
7. Click "DEPLOY"

#### Option 3: Using Secret Manager (Recommended for Sensitive Data)

```bash
# Create a secret
echo -n "your-database-password" | gcloud secrets create db-password --data-file=-

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding db-password \
  --member=serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Reference in Cloud Run (in cloudbuild.yaml or console)
```

---

## GitHub Integration

### 1. Connect GitHub Repository to Cloud Build

#### Via Google Cloud Console (Recommended)

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **"CREATE TRIGGER"**
3. Configure the trigger:
   - **Name**: `frontend-deploy`
   - **Event**: Push to a branch
   - **Source**: Connect your GitHub repository (you'll need to authorize Google Cloud)
   - **Repository**: Select your repository
   - **Branch**: `^main$` (or your primary branch)
   - **Configuration**: Cloud Build configuration file (YAML or JSON)
   - **Location**: `/cloudbuild.yaml` (or `frontend/cloudbuild.yaml` if in monorepo)
4. Click **"CREATE"**

#### Via gcloud CLI

```bash
# Connect repository (interactive)
gcloud builds triggers create github \
  --name=frontend-deploy \
  --repo-name=YOUR_REPO_NAME \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern=^main$ \
  --build-config=cloudbuild.yaml
```

### 2. Verify Trigger Setup

1. Push a commit to your main branch
2. Go to [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)
3. Verify the build starts automatically

---

## Deployment

### First Deployment

For the first deployment, you can manually trigger a build or push to GitHub:

#### Manual Deployment (One-time)

```bash
# Navigate to frontend directory
cd /Users/musaver/Desktop/central-distros-105th/username-password/frontend

# Submit build to Cloud Build
gcloud builds submit --config=cloudbuild.yaml
```

This will:
1. Build your Docker image
2. Push to Container Registry
3. Deploy to Cloud Run

#### Automatic Deployment via GitHub

Simply push your code to the main branch:

```bash
git add .
git commit -m "Deploy to Cloud Run"
git push origin main
```

Cloud Build will automatically:
1. Detect the push
2. Run the build from `cloudbuild.yaml`
3. Deploy the new version to Cloud Run

### Get Service URL

After deployment, retrieve your service URL:

```bash
gcloud run services describe frontend --region=us-central1 --format="value(status.url)"
```

### Update NEXTAUTH_URL

After getting your Cloud Run URL, update the `NEXTAUTH_URL` environment variable:

```bash
gcloud run services update frontend \
  --region=us-central1 \
  --update-env-vars="NEXTAUTH_URL=https://your-service-url.run.app"
```

---

## Custom Domain (Optional)

### Map a Custom Domain

```bash
# Map domain to Cloud Run service
gcloud run domain-mappings create \
  --service=frontend \
  --domain=yourdomain.com \
  --region=us-central1

# Get DNS records to configure
gcloud run domain-mappings describe \
  --domain=yourdomain.com \
  --region=us-central1
```

Add the DNS records shown to your domain registrar.

---

## Local Testing

### Test Docker Build Locally

```bash
# Navigate to frontend directory
cd /Users/musaver/Desktop/central-distros-105th/username-password/frontend

# Build Docker image
docker build -t frontend-test .

# Run container locally
docker run -p 8080:8080 \
  -e DATABASE_URL="your_database_url" \
  -e NEXTAUTH_SECRET="your_secret" \
  -e NEXTAUTH_URL="http://localhost:8080" \
  frontend-test

# Access at http://localhost:8080
```

### Test with Environment File

Create a `.env.docker` file (don't commit this):

```bash
docker run -p 8080:8080 --env-file .env.docker frontend-test
```

---

## Troubleshooting

### Build Fails

**Check Build Logs:**
```bash
# View recent builds
gcloud builds list --limit=5

# View specific build logs
gcloud builds log BUILD_ID
```

**Common Issues:**
- Missing dependencies in `package.json`
- Build timeouts (increase timeout in `cloudbuild.yaml`)
- Insufficient permissions (check IAM roles)

### Container Fails to Start

**View Cloud Run Logs:**
```bash
gcloud run services logs read frontend --region=us-central1 --limit=50
```

**Common Issues:**
- Missing environment variables
- Database connection failures
- Port misconfiguration (must use 8080)
- Missing `output: 'standalone'` in `next.config.ts`

### Database Connection Issues

**Check:**
1. Database is accessible from Cloud Run
2. Database URL is correct in environment variables
3. If using Cloud SQL, ensure Cloud SQL connector is configured
4. Firewall rules allow Cloud Run IP addresses

**For Cloud SQL:**
```bash
# Update Cloud Run to use Cloud SQL connection
gcloud run services update frontend \
  --region=us-central1 \
  --add-cloudsql-instances=YOUR_PROJECT_ID:REGION:INSTANCE_NAME
```

### Images Not Loading

**Verify Image Domains:**
- Check `next.config.ts` has correct `remotePatterns`
- If using Vercel Blob Storage, ensure it's still accessible
- Consider migrating images to Google Cloud Storage

### Slow Build Times

**Optimize:**
- Use `.dockerignore` to exclude unnecessary files
- Enable Docker layer caching in Cloud Build
- Consider using Artifact Registry instead of Container Registry

### Check Service Status

```bash
# Describe service
gcloud run services describe frontend --region=us-central1

# Check recent revisions
gcloud run revisions list --service=frontend --region=us-central1
```

---

## Useful Commands

```bash
# View all Cloud Run services
gcloud run services list

# Delete a service
gcloud run services delete frontend --region=us-central1

# View service configuration
gcloud run services describe frontend --region=us-central1

# Update service configuration
gcloud run services update frontend --region=us-central1 [OPTIONS]

# View logs in real-time
gcloud run services logs tail frontend --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic frontend --region=us-central1 --to-revisions=REVISION_NAME=100
```

---

## Cost Optimization

Cloud Run charges based on:
- CPU and Memory usage
- Request count
- Egress bandwidth

**Tips to reduce costs:**
1. Set appropriate memory limits (2Gi is often sufficient)
2. Configure `--max-instances` to limit scaling
3. Use `--min-instances=0` to scale to zero when idle
4. Enable CPU throttling when idle
5. Monitor usage in [Cloud Console Billing](https://console.cloud.google.com/billing)

---

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)

---

## Support

If you encounter issues:
1. Check the [troubleshooting section](#troubleshooting) above
2. Review Cloud Build and Cloud Run logs
3. Consult Google Cloud Support or documentation
4. Check Next.js deployment guides for standalone mode

**Quick Access Links:**
- [Cloud Run Console](https://console.cloud.google.com/run)
- [Cloud Build Console](https://console.cloud.google.com/cloud-build)
- [Container Registry](https://console.cloud.google.com/gcr)
