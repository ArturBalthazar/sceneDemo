# Git Push Guide

## Overview
This document explains git push operations with practical examples.

## What is Git Push?

`git push` is a Git command used to upload local repository content to a remote repository. It transfers commits from your local repository to a remote repository.

## Basic Syntax
```bash
git push [remote] [branch]
```

## Common Git Push Commands

### 1. Simple Push
```bash
git push
```
Pushes the current branch to its upstream branch.

### 2. Push to Specific Remote and Branch
```bash
git push origin main
git push origin feature-branch
```
Pushes to a specific remote (usually 'origin') and branch.

### 3. Push All Branches
```bash
git push --all origin
```
Pushes all local branches to the remote.

### 4. Push Tags
```bash
git push --tags
git push origin v1.0.0
```
Pushes tags to the remote repository.

### 5. Force Push (Use with Caution!)
```bash
git push --force
git push --force-with-lease
```
**WARNING**: Force push can overwrite remote history. Use `--force-with-lease` for safer force pushing.

## Push Workflow Example

1. **Make changes to your files**
   ```bash
   echo "Hello World" > example.txt
   ```

2. **Stage the changes**
   ```bash
   git add example.txt
   ```

3. **Commit the changes**
   ```bash
   git commit -m "Add example file"
   ```

4. **Push to remote repository**
   ```bash
   git push origin main
   ```

## Setting Up Upstream Branch

When pushing a new branch for the first time:
```bash
git push -u origin new-feature-branch
```

The `-u` flag sets up tracking, so future `git push` commands will know where to push.

## Common Push Scenarios

### Scenario 1: First-time Repository Setup
```bash
git init
git add README.md
git commit -m "Initial commit"
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

### Scenario 2: Daily Development Workflow
```bash
# Make changes
git add .
git commit -m "Implement new feature"
git push
```

### Scenario 3: Creating and Pushing a New Branch
```bash
git checkout -b feature-branch
# Make changes
git add .
git commit -m "Work on new feature"
git push -u origin feature-branch
```

## Best Practices

1. **Always pull before pushing** to avoid conflicts:
   ```bash
   git pull origin main
   git push origin main
   ```

2. **Use descriptive commit messages**
3. **Avoid force pushing to shared branches**
4. **Use `--force-with-lease` instead of `--force` when necessary**
5. **Push regularly to backup your work**

## Troubleshooting

### Push Rejected (Non-fast-forward)
```
error: failed to push some refs to 'origin'
hint: Updates were rejected because the remote contains work that you do not have locally
```

**Solution**: Pull the latest changes first:
```bash
git pull origin main
git push origin main
```

### Authentication Issues
Make sure you're authenticated with the remote repository (SSH keys or personal access tokens).

## Demo Usage

Run the included demo script to see these concepts in action:
```bash
./git-push-demo.sh
```

This script creates example files and demonstrates various push scenarios.