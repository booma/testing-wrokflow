/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

const { Octokit } = require("@octokit/core");
const { createProbotAuth } = require("octokit-auth-probot");
const { createAppAuth } = require("@octokit/auth-app");
const { config, composeConfigGet } = require("@probot/octokit-plugin-config");
const { Probot } = require('probot');
const creon = require('node-cron');
const scheduleConfig = require('./config');
const { getPrivateKey } = require('@probot/get-private-key');
const {scheduler}  = require('probot-scheduler');
const ProbotOctokit = Octokit.defaults({
  authStrategy: createProbotAuth,
});


const processPull = async (pull, octokit, config, log) => {
  try {
   
    await octokit.issues.createComment({
      owner: pull.base.repo.owner.login,
      repo: pull.base.repo.name,
      issue_number: pull.number,
      body: config.closureComment,
    });


    return await octokit.pulls.update({
      owner: pull.base.repo.owner.login,
      repo: pull.base.repo.name,
      pull_number: pull.number,
      state: "closed"
    });
  }
  catch(error){
    console.log(error);
  }
}

const processRepository = async (repository, octokit, config, log) => {
  pulls = await octokit.pulls.list({ owner: repository.owner.login, repo: repository.name})
  pulls.data.forEach(async (pull) => { await processPull(pull, octokit, config, log) })
}

module.exports = async (app) => {

  // Register the scheduler plugin
  app.on('schedule.repository', scheduler(app));

  // Define a scheduled task to close PRs at a specific time
  app.on('schedule.repository', async context => {
    

  app.log.info("Started pr-auto-close bot");
  const octokit = await app.auth(process.env.INSTALLATION_ID, app.log);
   
  /*
   * Go get any PRs that were opened while we were not running.  Don't care about pagination
   * because the number of open PRs are in the single digits.
   */
  repositories = await octokit.apps.listReposAccessibleToInstallation();
  repositories.data.repositories.forEach(async (repository) => { await processRepository(repository, octokit, scheduleConfig, app.log) });



  /*
   * Handle PRs as they come in.
   */
  const prAutoCloseDays = scheduleConfig.interval;
   app.on(["pull_request.opened", "pull_request.reopened"], async (context) => {
        const createdAt = new Date(context.payload.pull_request.created_at);
        createdAt.setDate(createdAt.getDate() + prAutoCloseDays);
        const remainingTime = (createdAt - new Date()) / 1000;
         
        if(Math.floor(remainingTime) <= 0) {
          return processPull(context.payload.pull_request, octokit, scheduleConfig, app.log);
        }      
     }); 
  });
};
