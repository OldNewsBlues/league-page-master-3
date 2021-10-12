<script>
    import BarChart from '$lib/BarChart.svelte';
    import { generateGraph, round, predictScores, loadPlayers } from '$lib/utils/helper';
    import { managers } from '$lib/utils/leagueInfo';
    export let nflState, rostersData, users, playersInfo, leagueData;

    const rosters = rostersData.rosters;

    const currentManagers = {};

    let activeManagers = {};

	for(const managerID in managers) {
		const manager = managers[managerID];

		const entryMan = {
			managerID: manager.managerID,
			rosterID: manager.roster,
			name: manager.name,
			status: manager.status,
			yearsactive: manager.yearsactive,
		}

		if(!activeManagers[manager.roster] && manager.status == "active") {
			activeManagers[manager.roster] = [];
            activeManagers[manager.roster].push(entryMan);
		}
	}

    for(const roster of rosters) {
        const user = users[roster.owner_id];
        const rosterID = roster.roster_id;

        let recordManager = activeManagers[rosterID];
        let recordManID = recordManager[0].managerID;

        currentManagers[recordManID] = {
            avatar: `https://sleepercdn.com/avatars/thumbs/${user.avatar}`,
            name: user.metadata.team_name ? user.metadata.team_name : user.display_name,
            realname: recordManager[0].name,
        }
    }

    let validGraph = false;

    let graphs = [];

    const buildRankings = () => {
        const rosterPowers = [];
        let week = nflState.week;
        if(week == 0) {
            week = 1;
        }
        let max = 0;

        for(const roster of rosters) {

            const rosterID = roster.roster_id;

            let recordManager = activeManagers[rosterID];
            let recordManID = recordManager[0].managerID;
            // make sure the roster has players on it
            if(!roster.players) continue;
            // if at least one team has players, create the graph
            validGraph = true;

            const rosterPlayers = [];

            for(const rosterPlayer of roster.players) {
                rosterPlayers.push({
                    name: players[rosterPlayer].ln,
                    pos: players[rosterPlayer].pos,
                    wi: players[rosterPlayer].wi
                })
            }

            const rosterPower = {
                rosterID: roster.roster_id,
                recordManID,
                manager: currentManagers[recordManID],
                powerScore: 0,
            }
            const seasonEnd = 18;
            for(let i = week; i < seasonEnd; i++) {
                rosterPower.powerScore += predictScores(rosterPlayers, i, leagueData);
            }
            if(rosterPower.powerScore > max) {
                max = rosterPower.powerScore;
            }
            rosterPowers.push(rosterPower);
        }

        for(const rosterPower of rosterPowers) {
            rosterPower.powerScore = round(rosterPower.powerScore/max * 100);
        }

        const powerGraph = {
            stats: rosterPowers,
            x: "Manager",
            y: "Power Ranking",
            stat: "",
            header: "Rest of Season Power Rankings",
            field: "powerScore",
            short: "ROS Power Ranking"
        };

        graphs = [
            generateGraph(powerGraph, 10)
        ]
    }

    let players = playersInfo.players;

    buildRankings();

    const refreshPlayers = async () => {
        const newPlayersInfo = await loadPlayers(true);
        players = newPlayersInfo.players;
        buildRankings();
    }

    if(playersInfo.stale) {
        refreshPlayers();
    }

    let curGraph = 0;

    let el;
    let maxWidth = 620;


    const resize = (w) => {
        const left = el?.getBoundingClientRect() ? el?.getBoundingClientRect().left  : 0;
        const right = el?.getBoundingClientRect() ? el?.getBoundingClientRect().right  : 0;

        maxWidth = right - left;
    }
    let innerWidth;

    $: resize(innerWidth);

</script>

<svelte:window bind:innerWidth={innerWidth} />

<style>
    .enclosure {
        display: block;
        position: relative;
        width: 100%;
    }
</style>

{#if validGraph}
    <div class="enclosure" bind:this={el}>
        <BarChart {maxWidth} {graphs} bind:curGraph={curGraph} />
    </div>
{/if}