# VisionFlow-AI Custom Workspace Rules

## Deployment Rules (Hugging Face & GitHub)

Always use the **Orphan Clean Push** method to deploy backend (Hugging Face) and frontend (GitHub/Vercel) to avoid leak detection and dirty branch histories.

### Backend Deployment (Hugging Face Space)
Run the following inside `backend/`:
```powershell
git checkout -b temp-cleanup-main
git branch -D clean-main
git checkout --orphan clean-main
git reset
git add -A
git commit -m "deploy: clean initial backend rebuild"
git push https://Yousef891238:<hf_token>@huggingface.co/spaces/Yousef891238/088098 clean-main:main --force
git checkout clean-main
git branch -D temp-cleanup-main
```

### Frontend Deployment (GitHub)
Run the following in the root folder:
```powershell
git checkout -b temp-cleanup-master
git branch -D clean-master
git checkout --orphan clean-master
git reset
git add -A
git commit -m "deploy: VisionFlow-AI - clean initial commit"
git push origin clean-master:master --force
git checkout clean-master
git branch -D temp-cleanup-master
```

### Git Ignoring Batch Files
Never commit `DEPLOY_TO_HF.bat`, `PUSH_TO_GITHUB.bat`, or `hf_token.txt`! Both root and backend `.gitignore` files must list them explicitly.
