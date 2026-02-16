/**
 * PR Comment Management
 *
 * Creates and updates PR comments with design review information
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { CommentMode } from '../types';
import { getCommentMarker } from '../comment-builder';

type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * Post or update a design review comment on a PR
 */
export async function postComment(
  octokit: Octokit,
  prNumber: number,
  body: string,
  mode: CommentMode,
  commentId?: string
): Promise<number | undefined> {
  if (mode === 'none') {
    core.info('Comment mode is "none", skipping PR comment');
    return undefined;
  }

  const context = github.context;
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  if (mode === 'update') {
    // Try to find and update existing comment
    const existingCommentId = await findExistingComment(octokit, prNumber, commentId);

    if (existingCommentId) {
      core.info(`Updating existing comment #${existingCommentId}`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingCommentId,
        body,
      });
      return existingCommentId;
    }
  }

  // Create new comment
  core.info('Creating new PR comment');
  const response = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });

  core.info(`Created comment #${response.data.id}`);
  return response.data.id;
}

/**
 * Find an existing design review comment on the PR
 */
async function findExistingComment(
  octokit: Octokit,
  prNumber: number,
  commentId?: string
): Promise<number | undefined> {
  const context = github.context;
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  try {
    // Fetch all comments on the PR (paginated)
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        page,
        per_page: perPage,
      });

      const marker = getCommentMarker(commentId);
      for (const comment of response.data) {
        if (comment.body?.includes(marker)) {
          return comment.id;
        }
      }

      if (response.data.length < perPage) {
        break;
      }
      page++;
    }

    return undefined;
  } catch (error) {
    core.warning(`Failed to search for existing comments: ${error}`);
    return undefined;
  }
}

/**
 * Delete our design review comment from a PR
 */
export async function deleteComment(
  octokit: Octokit,
  prNumber: number,
  commentId?: string
): Promise<boolean> {
  const existingCommentId = await findExistingComment(octokit, prNumber, commentId);

  if (!existingCommentId) {
    core.info('No existing comment found to delete');
    return false;
  }

  const context = github.context;

  try {
    await octokit.rest.issues.deleteComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existingCommentId,
    });

    core.info(`Deleted comment #${existingCommentId}`);
    return true;
  } catch (error) {
    core.warning(`Failed to delete comment: ${error}`);
    return false;
  }
}

/**
 * Add a reaction to a comment
 */
export async function addReaction(
  octokit: Octokit,
  commentId: number,
  reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'
): Promise<void> {
  const context = github.context;

  try {
    await octokit.rest.reactions.createForIssueComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: commentId,
      content: reaction,
    });
  } catch (error) {
    core.debug(`Failed to add reaction: ${error}`);
  }
}
