#!/bin/bash

# Git Push Demo Script
# This script demonstrates various git push operations

echo "=== Git Push Demo ==="
echo "This demo shows different git push scenarios"
echo ""

# Function to show current git status
show_status() {
    echo "--- Current Git Status ---"
    git status --short
    echo "--- Recent Commits ---"
    git log --oneline -3
    echo ""
}

# Function to create and commit a demo file
create_demo_file() {
    local filename=$1
    local content=$2
    echo "Creating demo file: $filename"
    echo "$content" > "$filename"
    git add "$filename"
    git commit -m "Add $filename for git push demo"
    echo "File created and committed!"
    echo ""
}

# Function to demonstrate different push operations
demo_push_operation() {
    local operation=$1
    echo "--- Demo: $operation ---"
    case $operation in
        "simple")
            echo "Demonstrating: git push (simple push to current branch)"
            echo "Command: git push"
            ;;
        "branch")
            echo "Demonstrating: git push origin <branch> (push specific branch)"
            echo "Command: git push origin $(git branch --show-current)"
            ;;
        "all-branches")
            echo "Demonstrating: git push --all (push all branches)"
            echo "Command: git push --all"
            ;;
        "tags")
            echo "Demonstrating: git push --tags (push all tags)"
            echo "Command: git push --tags"
            ;;
        "force")
            echo "Demonstrating: git push --force (force push - use with caution!)"
            echo "Command: git push --force"
            echo "WARNING: Force push can overwrite remote history!"
            ;;
    esac
    echo ""
}

# Main demo execution
echo "Starting Git Push Demo..."
echo ""

# Show initial status
show_status

# Create demo files to work with
create_demo_file "demo-file-1.txt" "This is the first demo file
Created to demonstrate git push operations
Timestamp: $(date)"

create_demo_file "demo-file-2.txt" "This is the second demo file
Used to show multiple commits and pushes
Timestamp: $(date)"

# Show status after creating files
show_status

# Demonstrate different push operations (informational only)
demo_push_operation "simple"
demo_push_operation "branch"
demo_push_operation "all-branches"
demo_push_operation "tags"
demo_push_operation "force"

echo "=== Demo Complete ==="
echo "Files created and committed locally."
echo "To actually push these changes, run: git push origin $(git branch --show-current)"
echo ""
echo "For more information about git push, see:"
echo "- git-push-guide.md"
echo "- Official Git documentation: https://git-scm.com/docs/git-push"