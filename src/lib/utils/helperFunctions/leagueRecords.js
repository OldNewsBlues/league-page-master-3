import { getLeagueData } from './leagueData';
import { leagueID, managers } from '$lib/utils/leagueInfo';
import { getNflState } from './nflState';
import { getLeagueRosters } from "./leagueRosters"
import { getLeagueUsers } from "./leagueUsers"
import { waitForAll } from './multiPromise';
import { get } from 'svelte/store';
import {records} from '$lib/stores';
import { loadPlayers, getPreviousDrafts } from '$lib/utils/helper';

export const getLeagueRecords = async (refresh = false) => {
	if(get(records).seasonWeekRecords) {
		return get(records);
	}

	// if this isn't a refresh data call, check if there are already transactions stored in localStorage
	if(!refresh) {
		let localRecords = await JSON.parse(localStorage.getItem("records"));
		// check if transactions have been saved to localStorage before
		if(localRecords) {
			localRecords.stale = true;
			return localRecords;
		}
	}

	const playersData = await loadPlayers().catch((err) => { console.error(err); });
	const playersInfo = playersData.players;

	const previousDraftsData = await getPreviousDrafts().catch((err) => { console.error(err); });
	let draftInfo = {};

	for(const key in previousDraftsData) {
		const prevDraft = previousDraftsData[key];
		
		if(!draftInfo[prevDraft.year]) {
			draftInfo[prevDraft.year] = prevDraft;
		}
	}

	const nflState = await getNflState().catch((err) => { console.error(err); });
	let week = 0;
	if(nflState.season_type == 'regular') {
		week = nflState.week - 1;
	} else if(nflState.season_type == 'post') {
		week = 18;
	}

	let curSeason = leagueID;

	let currentManagers;
	
	let currentYear;
	let lastYear;

	let allTimeMatchupDifferentials = [];

	let leagueRosterRecords = {}; 				// every full season stat point (for each year and all years combined)
	let seasonWeekRecords = []; 				// highest weekly points within a single season
	let leagueWeekRecords = [];					// highest weekly points within a single season
	let leagueWeekLows = []; 					// lowest weekly points within a single season
	let mostSeasonLongPoints = []; 				// 10 highest full season points
	let leastSeasonLongPoints = []; 			// 10 lowest full season points
	let allTimeBiggestBlowouts = []; 			// 10 biggest blowouts
	let allTimeClosestMatchups = []; 			// 10 closest matchups
	let individualWeekRecords = {}; 			// weekly scores/matchup data indexed by managerID
	let allTimeWeekBests = []; 					// each manager's highest scoring week
	let allTimeWeekWorsts = []; 				// each manager's lowest scoring week
	let allTimeSeasonBests = []; 				// each manager's highest scoring season
	let allTimeSeasonWorsts = []; 				// each manager's lowest scoring season
	let allTimeEPERecords = [];					// each manager's all-time EPE stats
	let playerATSeasonBests = []; 				// each manager's all-time leading individual starter (season)
	let	playerATSeasonRecords = [];				// ranking all manager's all-time highest-scoring player (season), indexed by manager and season
	let playerATWeekBests = [];					// each manager's all-time best scoring week by individual starters
	let playerATWeekRecords = [];				// each manager's all-time best scoring week by individual starters, indexed by manager and season
	let playerATWeekTOPS = [];					// 10 all-time best scoring weeks by individual starters
	let playerATSeasonTOPS = [];				// 10 all-time best scoring seasons by individual starters
	let leagueManagers = {};
	let activeManagers = [];
	let playerRecords = {};
	let seasonPlayerRecords = {};
	let seasonTeamPOSRecords = {};
	let acquisitionRecords = {};

	for(const managerID in managers) {
		const manager = managers[managerID];

		const entryMan = {
			managerID: manager.managerID,
			rosterID: manager.roster,
			name: manager.name,
			status: manager.status,
			yearsactive: manager.yearsactive,
		}

		if(!leagueManagers[manager.roster]) {
			leagueManagers[manager.roster] = [];
		}
		leagueManagers[manager.roster].push(entryMan);

		if(manager.status == "active") {
			activeManagers.push(manager.managerID);
		}
	}

	while(curSeason && curSeason != 0) {
		const [rosterRes, users, leagueData] = await waitForAll(
			getLeagueRosters(curSeason),
			getLeagueUsers(curSeason),
			getLeagueData(curSeason),
		).catch((err) => { console.error(err); });
	
		let year = parseInt(leagueData.season);

		// on first run, week is provided above from nflState,
		// after that get the final week of regular season from leagueData
		if(leagueData.status == 'complete' || week > leagueData.settings.playoff_week_start - 1) {
			week = leagueData.settings.playoff_week_start - 1;
		}

		lastYear = year;
	
		const rosters = rosterRes.rosters;
		
		for(const roster of rosters) {
			const rosterID = roster.roster_id;		

			let recordManager = leagueManagers[rosterID].filter(m => m.yearsactive.includes(year));
			let recordManrosterID = recordManager[0].rosterID;
			let recordManID = recordManager[0].managerID;
			
			const draftResults = draftInfo[year].draft;
			for(const round in draftResults) {
				const draftPicks = draftResults[round];

				for(const pick in draftPicks) {
					const draftPick = draftPicks[pick].player;

					if(!acquisitionRecords[year]) {
						acquisitionRecords[year] = {};
					}

					if(draftPick.rosterID == recordManrosterID) {

						if(!acquisitionRecords[year][recordManID]) {
							acquisitionRecords[year][recordManID] = [];
						}
						acquisitionRecords[year][recordManID].push(draftPick);
					}
				}
			}
		}

		const originalManagers = {};
	
		for(const roster of rosters) {
			const rosterID = roster.roster_id;
			const user = users[roster.owner_id];
			
			let recordManager = leagueManagers[rosterID].filter(m => m.yearsactive.includes(year));
			let recordManID = recordManager[0].managerID;

			if(user) {
				originalManagers[recordManID] = {
					avatar: `https://sleepercdn.com/avatars/thumbs/${user.avatar}`,
					name: user.metadata.team_name ? user.metadata.team_name : user.display_name,
					realname: recordManager[0].name,
				};
			} else {
				originalManagers[recordManID] = {
					avatar: `https://sleepercdn.com/images/v2/icons/player_default.webp`,
					name: 'Unknown Manager',
					realname: 'John Q. Rando',
				};
			}

			if(roster.settings.wins == 0 && roster.settings.ties == 0 && roster.settings.losses == 0) continue;

			if(!leagueRosterRecords[recordManID]) {
				leagueRosterRecords[recordManID] = {
					wins: 0,
					losses: 0,
					ties: 0,
					fptsFor: 0,
					fptsAgainst: 0,
					potentialPoints: 0,
					fptspg: 0,
					manager: originalManagers[recordManID],
					years: [],
				}
			}

			const fpts = roster.settings.fpts + (roster.settings.fpts_decimal / 100);
			const fptsAgainst = roster.settings.fpts_against + (roster.settings.fpts_against_decimal / 100);
			const potentialPoints = roster.settings.ppts + (roster.settings.ppts_decimal / 100);
			const fptspg = roster.settings.fpts / (roster.settings.wins + roster.settings.losses + roster.settings.ties);

			// add records to league roster record record
			leagueRosterRecords[recordManID].wins += roster.settings.wins;
			leagueRosterRecords[recordManID].losses += roster.settings.losses;
			leagueRosterRecords[recordManID].ties += roster.settings.ties;
			leagueRosterRecords[recordManID].fptsFor += fpts;
			leagueRosterRecords[recordManID].fptsAgainst += fptsAgainst;
			leagueRosterRecords[recordManID].potentialPoints += potentialPoints;
			leagueRosterRecords[recordManID].fptspg += fptspg;
			

			// add singleSeason info [`${year}fptsFor`]
			const singleYearInfo = {
				wins: roster.settings.wins,
				losses: roster.settings.losses,
				ties: roster.settings.ties,
				fpts,
				fptsAgainst,
				potentialPoints,
				fptspg,
				manager: originalManagers[recordManID],
				year,
				recordManID,
			}

			leagueRosterRecords[recordManID].years.push(singleYearInfo);

			mostSeasonLongPoints.push({
				recordManID,
				fpts,
				fptspg,
				year,
				manager: originalManagers[recordManID]
			})
			
			if(leagueData.status == 'complete' || week > leagueData.settings.playoff_week_start - 1) {
				leastSeasonLongPoints.push({
					recordManID,
					fpts,
					fptspg,
					year,
					manager: originalManagers[recordManID]
				})
			}
		}
		
		if(!currentManagers) {
			currentManagers = originalManagers;
		}

		// loop through each week of the season
		const matchupsPromises = [];
		let startWeek = parseInt(week);
		while(week > 0) {
			matchupsPromises.push(fetch(`https://api.sleeper.app/v1/league/${curSeason}/matchups/${week}`, {compress: true}))
			week--;
		}
	
		const matchupsRes = await waitForAll(...matchupsPromises).catch((err) => { console.error(err); });

		// convert the json matchup responses
		const matchupsJsonPromises = [];
		for(const matchupRes of matchupsRes) {
			const data = matchupRes.json();
			matchupsJsonPromises.push(data)
			if (!matchupRes.ok) {
				throw new Error(data);
			}
		}
		const matchupsData = await waitForAll(...matchupsJsonPromises).catch((err) => { console.error(err); });

		// now that we've used the current season ID for everything we need, set it to the previous season
		curSeason = leagueData.previous_league_id;

		const seasonPointsRecord = [];
		const seasonPointsLow = [];
		let matchupDifferentials = [];
		let indivweeks = {};
		let fptsWeeks = {};
		
		let duplicateKeyArr = [];

		let playerWeekTOPS = [];				// top 10 player single-week scores
		let	playerWeekBests = [];				// ranking all manager's highest-scoring player (week)
		let playerWeekEfforts = [];
		
		// process all the matchups
		for(const matchupWeek of matchupsData) {
			let matchups = {};

			for(const matchup of matchupWeek) {

				let recordManager = leagueManagers[matchup.roster_id].filter(m => m.yearsactive.includes(year));
				let recordManID = recordManager[0].managerID;

				const entry = {
					manager: originalManagers[recordManID],
					fpts: matchup.points,
					week: startWeek,
					year,
					rosterID: matchup.roster_id,
					epeWins: 0,
					epeTies: 0,
					epeLosses: 0,
					weekWinner: new Boolean(false),
					weekLoser: new Boolean(false),
					recordManID,
				}
				seasonPointsRecord.push(entry);
				seasonPointsLow.push(entry);
				leagueWeekRecords.push(entry);
				leagueWeekLows.push(entry);
	
				// add each entry to the matchup object
				if(!matchups[matchup.matchup_id]) {
					matchups[matchup.matchup_id] = [];
				}
				matchups[matchup.matchup_id].push(entry);

				if(!indivweeks[recordManID]) {
					indivweeks[recordManID] = [];
				}		
				indivweeks[recordManID].push(entry);	

				if(!fptsWeeks[startWeek]) {
					fptsWeeks[startWeek] = [];
				}		
				fptsWeeks[startWeek].push(entry.fpts);

				const starters = matchup.starters;
				const startersPTS = matchup.starters_points.sort((a, b) => b - a);

				const players = matchup.players;
				const playersPTS = matchup.players_points;
				
				for(let i = 0; i < players.length; i++) {

					const playerID = players[i];

					if(!playerRecords[year]) {
						playerRecords[year] = {};
					}
					if(!playerRecords[year][recordManID]) {
						playerRecords[year][recordManID] = {};
					}

					const playerPoints = playersPTS[playerID];

					let topStarter = new Boolean (false);
					let starterRank;
					let benched = new Boolean (true);

					if(starters.includes(playerID)) {
						benched = false;
						starterRank = startersPTS.indexOf(playerPoints) + 1;
						if(startersPTS[0] == playerPoints) {
							topStarter = true;
						}
					} else {
						benched = true;
						topStarter = false;
						starterRank = 0;
					}
					
					// idea for dupe check is to push unique info into array the first time the playerID is seen (so you can later check array for dupes)
					let isDuplicate = new Boolean (false);
					let playerInfo = playersInfo[playerID];
					let duplicateCheck = {
						fn: playerInfo.fn,
						ln: playerInfo.ln,
						pos: playerInfo.pos,
						t: playerInfo.t,
					}
					if(!duplicateKeyArr[recordManID]) {
						duplicateKeyArr[recordManID] = [];
					}
					if(!playerRecords[year][recordManID][playerID]) {
						playerRecords[year][recordManID][playerID] = [];
						duplicateKeyArr[recordManID].push(duplicateCheck);
					}
					// duplicateKeyArr[recordManID].forEach(str => isDuplicate[str] ? alert(str) : isDuplicate[str] = true);
					// DUPE CHECK NOT COMPLETE/WORKING (& not entirely sure if necessary)

					const playerEntry = {		
						recordManID,
						manager: originalManagers[recordManID],
						week: startWeek,
						year,
						rosterID: matchup.roster_id,
						playerID,
						playerPoints,
						benched,
						howAcquired: null,
						weekAcquired: null,
						topStarter,
						starterRank,
						playerInfo,
						isDuplicate,
					}

					// right now, acquisitions is just a list of the manager's draft picks
					let acquisitions = acquisitionRecords[year][recordManID];
					for(let i = 0; i < acquisitions.length; i++) {
						if(acquisitions[i].playerID == playerID) {
							playerEntry.howAcquired = 'draft';
							playerEntry.weekAcquired = 0;
						} 
					}
					
					playerRecords[year][recordManID][playerID].push(playerEntry);
				}
				
			}
			startWeek--;
			
					      
			// create matchup differentials from matchups obj
			for(const matchupKey in matchups) {
				const matchup = matchups[matchupKey];
				let home = matchup[0];
				let away = matchup[1];
				if(matchup[0].fpts < matchup[1].fpts) {
					home = matchup[1];
					away = matchup[0];
				}
				const matchupDifferential = {
					year: home.year,
					week: home.week,
					home: {
						manager: home.manager,
						fpts: home.fpts,
						recordManID: home.recordManID,
					},
					away: {
						manager: away.manager,
						fpts: away.fpts,
						recordManID: away.recordManID,
					},
					differential: home.fpts - away.fpts
				}
				allTimeMatchupDifferentials.push(matchupDifferential);
				matchupDifferentials.push(matchupDifferential);
			}
		}

		// first time around, create per-season objects for season-long player & team/pos records
		if(!seasonPlayerRecords[year]) {
			seasonPlayerRecords[year] = {};
		}
		if(!seasonTeamPOSRecords[year]) {
			seasonTeamPOSRecords[year] = {};
		}

		// create team/pos objects, setting baseline at 0
		for(const recordManID in playerRecords[year]) {
			const playerRecord = playerRecords[year][recordManID];

			let	positionFPTS = {
				QB: 0,
				RB: 0,
				WR: 0,
				TE: 0,
				K: 0,
				DEF: 0,
			};
			let	teamFPTS = {
				ARI: 0,
				ATL: 0,
				BAL: 0,
				BUF: 0,
				CAR: 0,
				CHI: 0,
				CIN: 0,
				CLE: 0,
				DAL: 0,
				DEN: 0,
				DET: 0,
				GB: 0,
				HOU: 0,
				IND: 0,
				JAX: 0,
				KC: 0,
				LAC: 0,
				LAR: 0,
				LV: 0,
				MIA: 0,
				MIN: 0,
				NE: 0,
				NO: 0,
				NYG: 0,
				NYJ: 0,
				PHI: 0,
				PIT: 0,
				SEA: 0,
				SF: 0,
				TEN: 0,
				TB: 0,
				WAS: 0,
			};

			let playerWeekBest = 0;
			let weekBestPlayer = null;

			// NOTE: May need to remove duplicates (if any, eg., due to players changing IDs mid-season) before this point (otherwise they'd count twice towards totals)
			for(const playerID in playerRecord) {
				const playRec = playerRecord[playerID];

				for(const key in playRec) {
					const play = playRec[key];
					
					if(play.playerPoints > playerWeekBest && play.benched == false) {
						playerWeekBest = play.playerPoints;

						if(!playerWeekEfforts[recordManID]) {
							playerWeekEfforts[recordManID] = [];
						}
						playerWeekEfforts[recordManID].push(playRec[key]);
					}
				}
			}

			for(const playerID in playerRecord) {
				const playRec = playerRecord[playerID];
				// // single-week ranks & records
		

				for(let i = 0; i < playRec.length; i++) {
					
					// grab every player's score every week for season & all-time single-week records
					const pWTEntry = {
						playerInfo: playRec[i].playerInfo,
						playerID,
						fpts: playRec[i].playerPoints,
						manager: playRec[i].manager,
						recordManID,
						year: playRec[i].year,
						week: playRec[i].week
					}

					playerWeekTOPS.push(pWTEntry);
					playerATWeekTOPS.push(pWTEntry);
				}
				
				// season-long ranks & records

				let weeksStarted = 0; 			// # of weeks manager started player
				let	numWeeksOwned = 0;			// # of weeks manager owned player
				let	whichWeeksOwned = [];		// array of weeks when manager owned player
				let	playerFPTSscored = 0;		// total (season) FPTS player scored as a starter for manager
				let playerFPTSposs = 0;			// total (season) FPTS player scored while on manager's roster (ie. including when on bench)
				let	totalTopStarter = 0;		// # of weeks where player was the manager's highest-scoring starter

				numWeeksOwned = playRec.length;

				for(let i = 0; i < playRec.length; i++) {

					playerFPTSposs += playRec[i].playerPoints;
					whichWeeksOwned.push(playRec[i].week);

					if(playRec[i].benched == false) {

						weeksStarted++;
						playerFPTSscored += playRec[i].playerPoints;

						teamFPTS[playRec[i].playerInfo.t] += playRec[i].playerPoints;
						positionFPTS[playRec[i].playerInfo.pos] += playRec[i].playerPoints;

						if(playRec[i].topStarter == true) {
							totalTopStarter++;
						}
					}
				}

				if(!seasonPlayerRecords[year][recordManID]) {
					seasonPlayerRecords[year][recordManID] = {};
				}
				if(!seasonPlayerRecords[year][recordManID][playerID]) {
					seasonPlayerRecords[year][recordManID][playerID] = {	
						recordManID,
						playerID,
						manager: originalManagers[recordManID],
						playerInfo: playersInfo[playerID],
						year,
						weeksStarted,
						numWeeksOwned,
						whichWeeksOwned,
						playerFPTSscored,
						playerFPTSposs,
						totalTopStarter,
					}
				}
			}

			if(!seasonTeamPOSRecords[year][recordManID]) {
				seasonTeamPOSRecords[year][recordManID] = {
					positionFPTS,
					teamFPTS,
					manager: originalManagers[recordManID],
					recordManID,
					year,
				}
			}
		}	
		
		for(const recordManID in playerWeekEfforts) {
			const playerWeekEffort = playerWeekEfforts[recordManID];
			const pWBest = playerWeekEffort[playerWeekEffort.length - 1]

			const pWBEntry = {
				playerInfo: pWBest.playerInfo,
				playerID: pWBest.playerID,
				fpts: pWBest.playerPoints,
				manager: pWBest.manager,
				recordManID: pWBest.recordManID,
				year: pWBest.year,
				week: pWBest.week,
			}

			playerWeekBests.push(pWBEntry);

			if(!playerATWeekRecords[recordManID]){
				playerATWeekRecords[recordManID] = [];
			}
			playerATWeekRecords[recordManID].push(pWBEntry);
		}
		
		// create season-record arrays 
		let weekBests = [];						// ranking all managers' personal best week of season
		let weekWorsts = [];					// ranking......personal worst.....
		let seasonBests = [];					// ranking all managers' personal season-long top scores
		let seasonWorsts = [];					// ranking......personal lows......
		let seasonEPERecords = [];				// ranking all managers' personal season-long EPE stats
		let playerSeasonTOPS = [];				// top 10 player season-long scores
		let	playerSeasonBests = [];				// ranking all manager's highest-scoring player (season)

		// calculate season records
		for(const recordManID in seasonPlayerRecords[year]) {
			const seasonPlayerRecord = seasonPlayerRecords[year][recordManID];
			let playerSeasonBest = 0;
			let seasonBestPlayer = null;

			for(const playerID in seasonPlayerRecord) {
				const player = seasonPlayerRecord[playerID];
				const fptspg = player.playerFPTSscored / player.weeksStarted

				const pSTEntry = {
					playerInfo: player.playerInfo,
					playerID,
					fpts: player.playerFPTSscored,
					weeksStarted: player.weeksStarted,
					fptspg,
					totalTopStarter: player.totalTopStarter,
					manager: player.manager,
					recordManID,
					year,
				}
				playerSeasonTOPS.push(pSTEntry);
				playerATSeasonTOPS.push(pSTEntry);
			}

			for(const key in seasonPlayerRecord) {
				const player = seasonPlayerRecord[key];

				if(player.playerFPTSscored > playerSeasonBest) {
					playerSeasonBest = player.playerFPTSscored;
					seasonBestPlayer = player.playerID;
				}
			}

			const fptspg = playerSeasonBest / seasonPlayerRecord[seasonBestPlayer].weeksStarted;

			let pSBEntry = {
				playerInfo: seasonPlayerRecord[seasonBestPlayer].playerInfo,
				playerID: seasonPlayerRecord[seasonBestPlayer].playerID,
				fpts: playerSeasonBest,
				weeksStarted: seasonPlayerRecord[seasonBestPlayer].weeksStarted,
				fptspg,
				totalTopStarter: seasonPlayerRecord[seasonBestPlayer].totalTopStarter,
				manager: seasonPlayerRecord[seasonBestPlayer].manager,
				recordManID,
				year,
			}

			playerSeasonBests.push(pSBEntry);

			if(!playerATSeasonRecords[recordManID]) {
				playerATSeasonRecords[recordManID] = [];
			}
			playerATSeasonRecords[recordManID].push(pSBEntry);
		}

		for(const recordManID in indivweeks) {
			const indivweek = indivweeks[recordManID];
			let bestweekfpts = 0;
			let worstweekfpts = 1000;

			let totalfpts = 0;
			let totalEPEWins = 0;
			let totalEPETies = 0;
			let totalEPELosses = 0;
			let totalWeekWinners = 0;
			let totalWeekLosers = 0;

			let bestWeek = {
				fpts: [],
				week: [],
				year: [],
				manager: [],
				recordManID: [],
			};
			let worstWeek = {
				fpts: [],
				week: [],
				year: [],
				manager: [],
				recordManID: [],
			};

			// going through every week for this roster
			for( let i = 0; i < indivweek.length; i++) {
				// check if this week's score is the best of roster's season; if so, set that as the new best score and grab the data from that week
				// need to add logic for (unlikely) scenario where you tie your own best/worst score
				if(indivweek[i].fpts > bestweekfpts) {
					bestweekfpts = indivweek[i].fpts;
					bestWeek = {
						fpts: indivweek[i].fpts,
						week: indivweek[i].week,
						year: indivweek[i].year,
						manager: indivweek[i].manager,
						recordManID: indivweek[i].recordManID,
					};
				}
				// check if this week's score is the worst of roster's season; if so, set and grab
				if(indivweek[i].fpts < worstweekfpts) {
					worstweekfpts = indivweek[i].fpts;
					worstWeek = {
						fpts: indivweek[i].fpts,
						week: indivweek[i].week,
						year: indivweek[i].year,
						manager: indivweek[i].manager,
						recordManID: indivweek[i].recordManID,
					};				
				}

				// compare roster's score to every score that week to determine whom they "beat", "tie", or "lose" to
				// note that fptsWeeks goes forward from week 1 while indivweek goes backward from the last played week 
				for( let x = 0; x < fptsWeeks[indivweek.length - i].length; x++) {
					if (indivweek[i].fpts > fptsWeeks[indivweek.length - i][x]) {
						indivweek[i].epeWins++;
					} else if (indivweek[i].fpts == fptsWeeks[indivweek.length - i][x]) {
						indivweek[i].epeTies++;
					} else {
						indivweek[i].epeLosses++;
					}
				}

				// reduce epeTies by one every week to account for the roster "tying" its own score
				indivweek[i].epeTies--;

				// determine if roster was the highest or lowest scorer that week
				// needs logic for (unlikely) scenario where you tie someone else for first/last place that week
				if (indivweek[i].epeWins == fptsWeeks[indivweek.length - i].length - 1) {
					indivweek[i].weekWinner = true;
					totalWeekWinners++;
				} else if (indivweek[i].epeWins == 0) {
					indivweek[i].weekLoser = true;
					totalWeekLosers++;
				}

				// add that week's fpts & EPE stats to the roster's running total for the season
				totalfpts += indivweek[i].fpts;
				totalEPEWins += indivweek[i].epeWins;
				totalEPETies += indivweek[i].epeTies;
				totalEPELosses += indivweek[i].epeLosses;
				
			}

			// calculate roster's season-long PPG & EPE Win %
			const totalfptspg = totalfpts / indivweek.length;
			const totalEPEWinPercentage = (totalEPEWins + totalEPETies / 2) / (totalEPEWins + totalEPETies + totalEPELosses) * 100;

			const weekEntry = {
				fptsBest: {bestWeek},
				fptsWorst: {worstWeek},
				totalfpts,
				totalfptspg,
				totalEPELosses,
				totalEPETies,
				totalEPEWins,
				totalEPEWinPercentage,
				totalWeekWinners,
				totalWeekLosers,
				recordManID,
				manager: originalManagers[recordManID],
				year,
			};

			const seasonEntry = {
				fpts: totalfpts,
				fptspg: totalfptspg,
				recordManID,
				manager: originalManagers[recordManID],
				year,
			};

			const seasonEPEEntry = {
				epeL: totalEPELosses,
				epeT: totalEPETies,
				epeW: totalEPEWins,
				epePerc: totalEPEWinPercentage,
				weekWin: totalWeekWinners,
				weekLoss: totalWeekLosers,
				recordManID,
				manager: originalManagers[recordManID],
				year,
			};

			if(!individualWeekRecords[recordManID]) {
				individualWeekRecords[recordManID] = [];
			}
			individualWeekRecords[recordManID].push(weekEntry);

			weekBests.push(bestWeek);
			weekWorsts.push(worstWeek);

			seasonBests.push(seasonEntry);
			seasonWorsts.push(seasonEntry);

			seasonEPERecords.push(seasonEPEEntry);
		}
		
		weekBests = weekBests.sort((a, b) => b.fpts - a.fpts);
		weekWorsts = weekWorsts.sort((a, b) => b.fpts - a.fpts);
		seasonBests = seasonBests.sort((a, b) => b.fpts - a.fpts);
		seasonWorsts = seasonWorsts.sort((a, b) => b.fpts - a.fpts);
		seasonEPERecords = seasonEPERecords.sort((a, b) => b.epePerc - a.epePerc);

		playerSeasonTOPS = playerSeasonTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
		playerSeasonBests = playerSeasonBests.sort((a, b) => b.fpts - a.fpts);
		playerWeekTOPS = playerWeekTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
		playerWeekBests = playerWeekBests.sort((a, b) => b.fpts - a.fpts);


		matchupDifferentials = matchupDifferentials.sort((a, b) => b.differential - a.differential);
		const biggestBlowouts = matchupDifferentials.slice(0, 10);

		const closestMatchups = [];
		for(let i = 0; i < 10; i++) {
			closestMatchups.push(matchupDifferentials.pop());
		}

		// per-season ranks & records to push thru seasonWeekRecords
		const interSeasonEntry = {
			year,
			biggestBlowouts,
			closestMatchups,
			weekBests,
			weekWorsts,
			seasonBests,
			seasonWorsts,
			seasonEPERecords,
			playerSeasonTOPS,
			playerSeasonBests,
			playerWeekTOPS,
			playerWeekBests,
			seasonPointsRecords: seasonPointsRecord.sort((a, b) => b.fpts - a.fpts).slice(0, 10),
			seasonPointsLows: seasonPointsLow.sort((a, b) => a.fpts - b.fpts).slice(0, 10)
		}

		if(interSeasonEntry.seasonPointsRecords.length > 0) {
			if(!currentYear) {
				currentYear = year;
			}
			seasonWeekRecords.push(interSeasonEntry);
		};
		
	} // SEASON LOOPS HERE

	// calculating all-time player records
	for(const recordManID in playerATWeekRecords) {
		const season = playerATWeekRecords[recordManID];

		let playerATWeekBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {
			if(season[i].fpts > playerATWeekBest) {
				playerATWeekBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		let pATWBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
			week: season[ATBestKey].week,
		};

		playerATWeekBests.push(pATWBEntry);

	}

	for(const recordManID in playerATSeasonRecords) {
		const season = playerATSeasonRecords[recordManID];

		let playerATSeasonBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {

			if(season[i].fpts > playerATSeasonBest) {
				playerATSeasonBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		const fptspg = season[ATBestKey].fpts / season[ATBestKey].weeksStarted;

		let pATSBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			weeksStarted: season[ATBestKey].weeksStarted,
			fptspg,
			totalTopStarter: season[ATBestKey].totalTopStarter,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
		};

		playerATSeasonBests.push(pATSBEntry);

	}
	
	// calculating all-time week/season records
	for(const recordManID in individualWeekRecords) {
		const individualWeekRecord = individualWeekRecords[recordManID];

		let allTimeBestWeekfpts = 0;
		let allTimeWorstWeekfpts = 1000;
		let allTimeBestSeasonfpts = 0;
		let allTimeWorstSeasonfpts = 5000;

		let allTimeEPEEntry = {
			epeL: 0,
			epeT: 0,
			epeW: 0,
			epePerc: 0,
			weekWin: 0,
			weekLoss: 0,
			recordManID: [],
			manager: [],
			year: [],
		};

		let allTimeBestWeek = {
			fpts: [],
			week: [],
			year: [],
			manager: [],
			recordManID: [],
		};
		let allTimeWorstWeek = {
			fpts: [],
			week: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		let allTimeBestSeason = {
			fpts: [],
			fptspg: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		let allTimeWorstSeason = {
			fpts: [],
			fptspg: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		// going through every season for this roster
		for(let i = 0; i < individualWeekRecord.length; i++) {

			if(individualWeekRecord[i].fptsBest.bestWeek.fpts > allTimeBestWeekfpts) {
				allTimeBestWeekfpts = individualWeekRecord[i].fptsBest.bestWeek.fpts;
				allTimeBestWeek = {
					fpts: individualWeekRecord[i].fptsBest.bestWeek.fpts,
					week: individualWeekRecord[i].fptsBest.bestWeek.week,
					year: individualWeekRecord[i].fptsBest.bestWeek.year,
					manager: individualWeekRecord[i].fptsBest.bestWeek.manager,
					recordManID: individualWeekRecord[i].fptsBest.bestWeek.recordManID,
				}
			}

			if(individualWeekRecord[i].fptsWorst.worstWeek.fpts < allTimeWorstWeekfpts) {
				allTimeWorstWeekfpts = individualWeekRecord[i].fptsWorst.worstWeek.fpts;
				allTimeWorstWeek = {
					fpts: individualWeekRecord[i].fptsWorst.worstWeek.fpts,
					week: individualWeekRecord[i].fptsWorst.worstWeek.week,
					year: individualWeekRecord[i].fptsWorst.worstWeek.year,
					manager: individualWeekRecord[i].fptsWorst.worstWeek.manager,
					recordManID: individualWeekRecord[i].fptsWorst.worstWeek.recordManID,
				}
			}

			if(individualWeekRecord[i].totalfpts > allTimeBestSeasonfpts) {
				allTimeBestSeasonfpts = individualWeekRecord[i].totalfpts;
				allTimeBestSeason = {
					fpts: individualWeekRecord[i].totalfpts,
					fptspg: individualWeekRecord[i].totalfptspg,
					year: individualWeekRecord[i].year,
					manager: individualWeekRecord[i].manager,
					recordManID: individualWeekRecord[i].recordManID,
				}
			}
				// needs (actual) logic to exclude current season
			if(individualWeekRecord[i].totalfpts < allTimeWorstSeasonfpts && individualWeekRecord[i].year != 2021) {
				allTimeWorstSeasonfpts = individualWeekRecord[i].totalfpts;
				allTimeWorstSeason = {
					fpts: individualWeekRecord[i].totalfpts,
					fptspg: individualWeekRecord[i].totalfptspg,
					year: individualWeekRecord[i].year,
					manager: individualWeekRecord[i].manager,
					recordManID: individualWeekRecord[i].recordManID,
				}
			}

			allTimeEPEEntry.epeL += individualWeekRecord[i].totalEPELosses;
			allTimeEPEEntry.epeT += individualWeekRecord[i].totalEPETies;
			allTimeEPEEntry.epeW += individualWeekRecord[i].totalEPEWins;
			allTimeEPEEntry.weekWin += individualWeekRecord[i].totalWeekWinners;
			allTimeEPEEntry.weekLoss += individualWeekRecord[i].totalWeekLosers;
			allTimeEPEEntry.recordManID = individualWeekRecord[i].recordManID;
			allTimeEPEEntry.manager = individualWeekRecord[i].manager;
			allTimeEPEEntry.year = individualWeekRecord[i].year;

		}

		allTimeEPEEntry.epePerc = ((allTimeEPEEntry.epeW + allTimeEPEEntry.epeT / 2) / (allTimeEPEEntry.epeW + allTimeEPEEntry.epeT + allTimeEPEEntry.epeL) * 100);

		allTimeWeekBests.push(allTimeBestWeek);
		allTimeWeekWorsts.push(allTimeWorstWeek);
		allTimeSeasonBests.push(allTimeBestSeason);
		allTimeSeasonWorsts.push(allTimeWorstSeason);

		allTimeEPERecords.push(allTimeEPEEntry);

	}

	allTimeWeekBests = allTimeWeekBests.sort((a, b) => b.fpts - a.fpts);
	allTimeWeekWorsts = allTimeWeekWorsts.sort((a, b) => b.fpts - a.fpts);
	allTimeSeasonBests = allTimeSeasonBests.sort((a, b) => b.fpts - a.fpts);
	allTimeSeasonWorsts = allTimeSeasonWorsts.sort((a, b) => b.fpts - a.fpts);
	playerATSeasonBests = playerATSeasonBests.sort((a, b) => b.fpts - a.fpts);
	playerATWeekBests = playerATWeekBests.sort((a, b) => b.fpts - a.fpts);


	allTimeEPERecords = allTimeEPERecords.sort((a, b) => b.epePerc - a.epePerc);


	allTimeMatchupDifferentials = allTimeMatchupDifferentials.sort((a, b) => b.differential - a.differential);
	allTimeBiggestBlowouts = allTimeMatchupDifferentials.slice(0, 10);

	for(let i = 0; i < 10; i++) {
		allTimeClosestMatchups.push(allTimeMatchupDifferentials.pop());
	}
	
	leagueWeekRecords = leagueWeekRecords.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	leagueWeekLows = leagueWeekLows.sort((a, b) => a.fpts - b.fpts).slice(0, 10);
	mostSeasonLongPoints = mostSeasonLongPoints.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	leastSeasonLongPoints = leastSeasonLongPoints.sort((a, b) => a.fpts - b.fpts).slice(0, 10);
	playerATSeasonTOPS = playerATSeasonTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	playerATWeekTOPS = playerATWeekTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);


	const recordsData = {
		allTimeBiggestBlowouts,
		allTimeClosestMatchups,
		allTimeWeekBests,
		allTimeWeekWorsts,
		allTimeSeasonBests,
		allTimeSeasonWorsts,
		allTimeEPERecords,
		mostSeasonLongPoints,
		leastSeasonLongPoints,
		playerATSeasonTOPS,
		playerATSeasonBests,
		playerATWeekTOPS,
		playerATWeekBests,
		leagueWeekLows,
		individualWeekRecords,
		leagueWeekRecords,
		seasonWeekRecords,
		leagueRosterRecords,
		currentManagers,
		currentYear,
		lastYear
	};

	// update localStorage
	localStorage.setItem("records", JSON.stringify(recordsData));

	records.update(() => recordsData);

	return recordsData;
}