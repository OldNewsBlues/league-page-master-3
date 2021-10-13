<script>
    import Button, { Group, Label } from '@smui/button';
    import BarChart from '../BarChart.svelte'
    import { cleanName, generateGraph, gotoManager, round } from '$lib/utils/helper';
    import { managers } from '$lib/utils/leagueInfo';

  	import DataTable, { Head, Body, Row, Cell } from '@smui/data-table'; 

    export let waiversData, tradesData, weekRecords, weekLows, seasonLongRecords, leastSeasonLongPoints, showTies, winPercentages, fptsHistories, lineupIQs, prefix, blowouts, closestMatchups, weekBests, weekWorsts, seasonBests, seasonWorsts, seasonEPERecords, allTimeEPERecords, allTimeSeasonBests, allTimeSeasonWorsts, allTimeWeekBests, allTimeWeekWorsts, individualWeekRecords, currentManagers, allTime=false, last=false;

    let leagueManagers = {};
    const numManagers = managers.length;

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
	}

    const lineupIQGraph = {
        stats: lineupIQs,
        x: "Manager",
        y: "Lineup IQ",
        stat: "%",
        header: "Manager Lineup IQ",
        field: "iq",
        short: "Lineup IQ"
    }

    const potentialPointsGraph = {
        stats: lineupIQs,
        x: "Manager",
        y: "Points",
        stat: "",
        header: "Potential Points vs Points",
        field: "potentialPoints",
        secondField: "fpts",
        short: "Potential Points"
    }

    const winsGraph = {
        stats: winPercentages,
        x: "Manager",
        y: "Wins",
        stat: "",
        header: "Team Wins",
        field: "wins",
        short: "Wins"
    }

    const winPercentagesGraph = {
        stats: winPercentages,
        x: "Manager",
        y: "Win Percentage",
        stat: "%",
        header: "Team Win Percentages",
        field: "percentage",
        short: "Win Percentage"
    }

    const fptsHistoriesGraph = {
        stats: fptsHistories,
        x: "Manager",
        y: "Fantasy Points",
        stat: "",
        header: "Team Fantasy Points",
        field: "fptsFor",
        short: "Fantasy Points"
    }
    
    const fptsSeasonBestGraph = {
        stats: seasonBests, //fptsSeasonBest
        x: "Manager",
        y: "Fantasy Points",
        stat: "",
        header: "Team Highest / Lowest Scoring Seasons",
        field: "fpts",
	    // secondField: "fptsFor",
        short: "Season Records"
    }
	
    const fptsWeekBestGraph = {
        stats: weekBests,
        // secondStats: weekWorsts, 
        x: "Manager",
        y: "Fantasy Points",
        stat: "",
        header: "Team Highest / Lowest Scoring Weeks",
        field: "fpts",
        // secondField: "fpts",
        // yMinOverride: 0,
        short: "Weekly Records"
    }
		
    const epeWinPercGraph = {
        stats: seasonEPERecords,
        x: "Manager",
        y: "EPE Win Percentage",
        stat: "%",
        header: "Everyone Plays Everyone Win Percentage",
        field: "epePerc",
        short: "EPE Records"
    }

    for(let i = 1; i <= numManagers; i++) {
        if(waiversData.find(w => w.recordManID == i)) {
            const trade = waiversData.find(w => w.recordManID == i);
            if(!tradesData.find(t => t.recordManID == i)) {
                tradesData.push({
                    recordManID: i,
                    manager: trade.manager,
                    trades: 0,
                })
            }
        }
    }

    const tradesGraph = {
        stats: tradesData,
        x: "Manager",
        y: "# of trades",
        stat: "",
        header: "Trades Managers Have Made",
        field: "trades",
        short: "Trades"
    }

    const waiversGraph = {
        stats: waiversData,
        x: "Manager",
        y: "# of Waiver Moves",
        stat: "",
        header: "Waivers Managers Have Made",
        field: "waivers",
        short: "Waivers"
    }
    
    const graphs = [];

    if(lineupIQs[0]?.potentialPoints) {
        graphs.push(generateGraph(lineupIQGraph));
    }
    graphs.push(generateGraph(winsGraph, 5));
    graphs.push(generateGraph(winPercentagesGraph));
    graphs.push(generateGraph(fptsHistoriesGraph));
    if(lineupIQs[0]?.potentialPoints) {
        graphs.push(generateGraph(potentialPointsGraph, 10, 0));
    }
    graphs.push(generateGraph(tradesGraph));
    graphs.push(generateGraph(waiversGraph));
    graphs.push(generateGraph(fptsSeasonBestGraph));
    graphs.push(generateGraph(fptsWeekBestGraph));
    graphs.push(generateGraph(epeWinPercGraph));

    const transactions = []; 
    
    for(let i = 1; i <= numManagers; i++) {
        if(waiversData.find(w => w.recordManID == i)) {
            const waiver = waiversData.find(w => w.recordManID == i);
            const trades = tradesData.find(t => t.recordManID == i)?.trades || 0;
            const waivers = waiver?.waivers || 0;
            const manager = waiver.manager;
            transactions.push({
                recordManID: i,
                manager,
                trades,
                waivers,
            })
        }
    }

    let curTable = 0;
    let curGraph = 0;

    let iqOffset = 0;
    const tables = [
        "Win Percentages",
        "Points",
        "Transactions",
        "Season Highs",
        "Season Lows",
        "Weekly Highs",
        "Weekly Lows",
        "EPE Records",
    ]
    if(!lineupIQs[0]?.potentialPoints) {
        iqOffset = 1;
    } else {
        tables.unshift('Lineup IQs');
    }
    const changeTable = (newGraph) => {
        switch (newGraph) {
            case 0 - iqOffset:
            case (4 + (99 * iqOffset)):
                curTable = 0;
                break;
            case 1 - iqOffset:
            case 2 - iqOffset:
                curTable = 1 - iqOffset;
                break;
            case 3 - iqOffset:
                curTable = 2 - iqOffset;
                break;
            case 5 - (2 * iqOffset):
            case 6 - (2 * iqOffset):
                curTable = 3 - iqOffset;
                break;
	         case 7 - (2 * iqOffset):
		        if(curTable == 4 - iqOffset || curTable == 5 - iqOffset) {
		            break;
		        }
		        curTable = 4 - iqOffset;
		        break;			
            case 8 - (2 * iqOffset):
		        if(curTable == 6 - iqOffset || curTable == 7 - iqOffset) {
		            break;
		        }
                curTable = 6 - iqOffset;
                break;
            case 9 - (2 * iqOffset):
                curTable = 8 - iqOffset;
                break;
// 	    case 10 - (2 * iqOffset):
// 		curTable = 7 - iqOffset;
// 		break;
            default:
                curTable = 0;
                break;
        }
    }

    const changeGraph = (newTable) => {
        switch (newTable) {
            case 0 - iqOffset:
                if(curGraph == 0 || curGraph == 4) {
                    break;
                }
                curGraph = 0;
                break;
            case 1 - iqOffset:
                if(curGraph == 1 - iqOffset || curGraph == 2 - iqOffset) {
                    break;
                }
                curGraph = 1 - iqOffset;
                break;
            case 2 - iqOffset:
                curGraph = 3 - iqOffset;
                break;
            case 3 - iqOffset:
                if(curGraph == 5 - (2 * iqOffset) || curGraph == 6 - (2 * iqOffset)) {
                    break;
                }
                curGraph = 5 - (2 * iqOffset);
                break;
            case 4 - iqOffset:
            case 5 - iqOffset:
                curGraph = 7 - (2 * iqOffset);
                break;
            case 6 - iqOffset:
            case 7 - iqOffset:
                curGraph = 8 - (2 * iqOffset);
                break;
	        case 8 - iqOffset:
                curGraph = 9 - (2 * iqOffset);
                break;
// 	    case 7 - iqOffset:
//                 curGraph = 10 - (2 * iqOffset);
//                 break;
            default:
                curGraph = 0;
                break;
        }
    }

    $: changeTable(curGraph);
    $: changeGraph(curTable);
    
    let innerWidth;

</script>

<svelte:window bind:innerWidth={innerWidth} />

<style>
    :global(.header) {
        text-align: center;
    }

    :global(.recordTable) {
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
        margin: 2em;
    }

    :global(.rankingTable) {
        display: table;
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
        margin: 2em auto 0.5em;
    }

    .fullFlex {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-around;
        margin: 3em auto 5em;
    }

    .testHolder {
        display: block;
        width: 100%;
        overflow-x: hidden;
    }

    .testInner {
        position: relative;
        display: flex;
        flex-wrap: nowrap;
        width: 100%;
    }

    .testWrapper {
        width: 50%;
    }

    .rankingHolder {
        display: block;
        width: 100%;
        overflow-x: hidden;
    }

    .subTitle {
        font-style: italic;
        font-size: 0.7em;
        color: #888;
        line-height: 1.2em;
    }

    h5 {
        text-align: center;
        margin: 2em 0 1em;
    }

    h4 {
        text-align: center;
        margin: 2em 0 1em;
    }

    .fantasyTeamName {
        font-style: italic;
        color: #999;
        font-size: 0.8em;
        line-height: 1.1em;
    }

    .rankingTableWrapper {
        width: 25%;
    }

    .rankingInner {
        position: relative;
        display: flex;
        flex-wrap: nowrap;
        width: 900%;
		transition: margin-left 0.8s;
    }

    .buttonHolder {
        text-align: center;
        margin: 2em 0 4em;
    }

    .buttonHolderRecords {
        text-align: center;
        margin: 2em 0 4em;
    }

    :global(.cellName) {
        cursor: pointer;
        line-height: 1.2em;
    }

    :global(.differentialName) {
        padding: 0.7em 0;
    }

    .center {
        text-align: center;
    }

    /* Start button resizing */

    @media (max-width: 540px) {
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.6em;
        }
    }

    @media (max-width: 415px) {
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.5em;
            padding: 0 6px;
        }
    }

    @media (max-width: 315px) {
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.45em;
            padding: 0 3px;
        }
    }

    /* End button resizing */

    /* Start record table resizing */

    @media (max-width: 510px) {
        :global(.recordTable th) {
            font-size: 0.8em;
            padding: 1px 12px;
        }
        :global(.recordTable td) {
            font-size: 0.8em;
            padding: 1px 12px;
        }
    }

    @media (max-width: 435px) {
        :global(.rank) {
            padding: 1px 0 1px 5px !important;
        }
        :global(.rank) {
            padding: 1px 0 1px 5px !important;
        }
    }

    @media (max-width: 420px) {
        :global(.recordTable th) {
            font-size: 0.6em;
            padding: 1px 12px;
        }
        :global(.recordTable td) {
            font-size: 0.6em;
            padding: 1px 12px;
        }
    }

    @media (max-width: 330px) {
        :global(.recordTable th) {
            font-size: 0.5em;
            padding: 1px 8px;
        }
        :global(.recordTable td) {
            font-size: 0.5em;
            padding: 1px 8px;
        }
    }

    /* END record table resizing */

    /* Start ranking table resizing */

    @media (max-width: 570px) {
        :global(.rankingTable th) {
            font-size: 0.8em;
            max-width: 110px;
            white-space: break-spaces;
            padding: 1px 12px;
        }
        :global(.rankingTable td) {
            font-size: 0.8em;
            max-width: 110px;
            white-space: break-spaces;
            padding: 1px 12px;
        }
    }

    @media (max-width: 410px) {
        :global(.rankingTable th) {
            font-size: 0.6em;
            max-width: 90px;
            white-space: break-spaces;
            padding: 1px 12px;
        }
        :global(.rankingTable td) {
            font-size: 0.6em;
            max-width: 90px;
            white-space: break-spaces;
            padding: 1px 12px;
        }
    }

    @media (max-width: 340px) {
        :global(.rankingTable th) {
            font-size: 0.55em;
            max-width: 80px;
            white-space: break-spaces;
            padding: 1px 6px;
        }
        :global(.rankingTable td) {
            font-size: 0.55em;
            max-width: 80px;
            white-space: break-spaces;
            padding: 1px 6px;
        }
    }

    /* END ranking table resizing */
</style>

<h4>{prefix} Records</h4>

<div class="fullFlex">
    {#if weekRecords && weekRecords.length}
	<DataTable class="recordTable">
	    <Head>
		<Row>
		    <Cell class="header" colspan=5>{prefix} Single-Week Scoring Records</Cell>
		</Row>
		<Row>
		    <Cell class="header rank"></Cell>
		    <Cell class="header">Manager</Cell>
			{#if allTime}
			    <Cell class="header">Year</Cell>
			{/if}
		    <Cell class="header">Week</Cell>
		    <Cell class="header">PF</Cell>
		</Row>
	    </Head>
	    <Body>
		{#each weekRecords as leagueWeekRecord, ix}
		    <Row>
			<Cell class="rank">{ix + 1}</Cell>
			<Cell class="cellName" on:click={() => gotoManager(leagueWeekRecord.recordManID)}>
			    {leagueWeekRecord.manager.realname}
			    {#if !allTime}
				<div class="fantasyTeamName">({leagueWeekRecord.manager.name})</div>
			    {/if}
			</Cell>
			    {#if allTime}
				<Cell class="center">{leagueWeekRecord.year}</Cell>
			    {/if}
			<Cell class="center">{leagueWeekRecord.week}</Cell>
			<Cell class="center">{round(leagueWeekRecord.fpts)}</Cell>
		    </Row>
		{/each}
	    </Body>
	</DataTable>
    {/if}

    {#if allTime}
	<DataTable class="recordTable">
	    <Head>
		<Row>
		    <Cell class="header" colspan=5>{prefix} Season-Long Scoring Records</Cell>
		</Row>
		<Row>
		    <Cell class="header rank"></Cell>
		    <Cell class="header">Manager</Cell>
		    <Cell class="header">Year</Cell>
		    <Cell class="header">PF</Cell>
		    <Cell class="header">PPG</Cell>
		</Row>
	    </Head>
	    <Body>
		{#each seasonLongRecords as mostSeasonLongPoint, ix}
		    <Row>
			<Cell class="rank">{ix + 1}</Cell>
			<Cell class="cellName" on:click={() => gotoManager(mostSeasonLongPoint.recordManID)}>
			    {mostSeasonLongPoint.manager.realname}
			    {#if !allTime}
				<div class="fantasyTeamName">({mostSeasonLongPoint.manager.name})</div>
			    {/if}
			</Cell>
			<Cell class="center">{mostSeasonLongPoint.year}</Cell>
			<Cell class="center">{round(mostSeasonLongPoint.fpts)}</Cell>
			<Cell class="center">{round(mostSeasonLongPoint.fptspg)}</Cell>
		    </Row>
		{/each}
	    </Body>
	</DataTable>
    {/if}

    {#if weekRecords && weekRecords.length}
        <DataTable class="recordTable">
            <Head>
                <Row>
                    <Cell class="header" colspan=5>{prefix} Single-Week Scoring Lows</Cell>
                </Row>
                <Row>
                    <Cell class="header rank"></Cell>
                    <Cell class="header">Manager</Cell>
                        {#if allTime}
                            <Cell class="header">Year</Cell>
                        {/if}
                    <Cell class="header">Week</Cell>
                    <Cell class="header">PF</Cell>
                </Row>
            </Head>
            <Body>
                {#each weekLows as leagueWeekLow, ix}
                    <Row>
                        <Cell class="rank">{ix + 1}</Cell>
                        <Cell class="cellName" on:click={() => gotoManager(leagueWeekLow.recordManID)}>
                            {leagueWeekLow.manager.realname}
                            {#if !allTime}
                                <div class="fantasyTeamName">({leagueWeekLow.manager.name})</div>
                            {/if}
                        </Cell>
                            {#if allTime}
                                <Cell class="center">{leagueWeekLow.year}</Cell>
                            {/if}
                        <Cell class="center">{leagueWeekLow.week}</Cell>
                        <Cell class="center">{round(leagueWeekLow.fpts)}</Cell>
                    </Row>
                {/each}
            </Body>
        </DataTable>
    {/if}
	
    {#if allTime}
    	<DataTable class="recordTable">
            <Head>
                <Row>
                    <Cell class="header" colspan=5>{prefix} Season-Long Scoring Lows</Cell>
                </Row>
                <Row>
                    <Cell class="header rank"></Cell>
                    <Cell class="header">Manager</Cell>
                    <Cell class="header">Year</Cell>
                    <Cell class="header">PF</Cell>
	    	        <Cell class="header">PPG</Cell>
                </Row>
            </Head>
            <Body>
                {#each leastSeasonLongPoints as leastSeasonLongPoint, ix}
                    <Row>
                        <Cell class="rank">{ix + 1}</Cell>
                        <Cell class="cellName" on:click={() => gotoManager(leastSeasonLongPoint.recordManID)}>
                            {leastSeasonLongPoint.manager.realname}
                            {#if !allTime}
                                <div class="fantasyTeamName">({leastSeasonLongPoint.manager.name})</div>
                            {/if}
                        </Cell>
                        <Cell class="center">{leastSeasonLongPoint.year}</Cell>
                        <Cell class="center">{round(leastSeasonLongPoint.fpts)}</Cell>
	    	            <Cell class="center">{round(leastSeasonLongPoint.fptspg)}</Cell>
                    </Row>
                {/each}
            </Body>
        </DataTable>
    {/if}

    {#if blowouts && blowouts.length}
        <DataTable class="recordTable">
            <Head>
                <Row>
                    <Cell class="header" colspan=5>{prefix} Largest Blowouts</Cell>
                </Row>
                <Row>
                    <Cell class="header rank"></Cell>
                    <Cell class="header">Matchup</Cell>
		            {#if allTime}
	                    <Cell class="header">Year</Cell>
		            {/if}
                    <Cell class="header">Week</Cell>
                    <Cell class="header">Diff</Cell>
                </Row>
            </Head>
            <Body>
                {#each blowouts as blowout, ix}
                    <Row>
                        <Cell class="rank">{ix + 1}</Cell>
                        <Cell class="cellName center differentialName">
                            <div class="center" on:click={() => gotoManager(blowout.home.recordManID)}>
                                {blowout.home.manager.realname} ({round(blowout.home.fpts)})
                                {#if !allTime}
                                    <div class="fantasyTeamName">({blowout.home.manager.name})</div>
                                {/if}
                            </div>
                            vs
                            <div class="center" on:click={() => gotoManager(blowout.away.recordManID)}>
                                {blowout.away.manager.realname} ({round(blowout.away.fpts)})
                                {#if !allTime}
                                    <div class="fantasyTeamName">({blowout.away.manager.name})</div>
                                {/if}
                            </div>
                        </Cell>
                            {#if allTime}
                                <Cell class="center">{blowout.year}</Cell>
                            {/if}
                        <Cell class="center">{blowout.week}</Cell>
                        <Cell class="center">{round(blowout.differential)}</Cell>
                    </Row>
                {/each}
            </Body>
        </DataTable>
    {/if}

    {#if closestMatchups && closestMatchups.length}
        <DataTable class="recordTable">
            <Head>
                <Row>
                    <Cell class="header" colspan=5>{prefix} Narrowest Wins</Cell>
                </Row>
                <Row>
                    <Cell class="header rank"></Cell>
                    <Cell class="header">Matchup</Cell>
		            {#if allTime}
	                    <Cell class="header">Year</Cell>
		            {/if}
                    <Cell class="header">Week</Cell>
                    <Cell class="header">Diff</Cell>
                </Row>
            </Head>
            <Body>
                {#each closestMatchups as closestMatchup, ix}
                    <Row>
                        <Cell class="rank">{ix + 1}</Cell>
                        <Cell class="cellName center differentialName">
                            <div class="center" on:click={() => gotoManager(closestMatchup.home.recordManID)}>
                                {closestMatchup.home.manager.realname} ({round(closestMatchup.home.fpts)})
                                {#if !allTime}
                                    <div class="fantasyTeamName">({closestMatchup.home.manager.name})</div>
                                {/if}
                            </div>
                            vs
                            <div class="center" on:click={() => gotoManager(closestMatchup.away.recordManID)}>
                                {closestMatchup.away.manager.realname} ({round(closestMatchup.away.fpts)})
                                {#if !allTime}
                                    <div class="fantasyTeamName">({closestMatchup.away.manager.name})</div>
                                {/if}
                            </div>
                        </Cell>
                            {#if allTime}
                                <Cell class="center">{closestMatchup.year}</Cell>
                            {/if}
                        <Cell class="center">{closestMatchup.week}</Cell>
                        <Cell class="center">{round(closestMatchup.differential)}</Cell>
                    </Row>
                {/each}
            </Body>
        </DataTable>
    {/if}
</div>

<h4>{prefix} Rankings</h4>

<BarChart maxWidth={innerWidth} {graphs} bind:curGraph={curGraph} />

<div class="rankingHolder">
    <div class="rankingInner" style="margin-left: -{100 * curTable}%;">
        {#if lineupIQs[0]?.potentialPoints}
            <div class="rankingTableWrapper">
                <DataTable class="rankingTable">
                    <Head>
                        <Row>
                            <Cell class="header" colspan=5>
                                {prefix} Lineup IQ Rankings
                                <div class="subTitle">
                                    The percentage of potential points each manager has captured
                                </div>
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Manager</Cell>
                            <Cell class="header">IQ</Cell>
                            <Cell class="header">PF</Cell>
                            <Cell class="header">Poss. PF</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each lineupIQs as lineupIQ, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell class="cellName" on:click={() => gotoManager(lineupIQ.recordManID)}>
                                    {lineupIQ.manager.realname}
                                    {#if !allTime}
                                        <div class="fantasyTeamName">({lineupIQ.manager.name})</div>
                                    {/if}
                                </Cell>
                                <Cell class="center">{lineupIQ.iq}%</Cell>
                                <Cell class="center">{lineupIQ.fpts}</Cell>
                                <Cell class="center">{lineupIQ.potentialPoints}</Cell>
                            </Row>
                        {/each}
                    </Body>
                </DataTable>
            </div>
        {/if}

        <div class="rankingTableWrapper">
            <DataTable class="rankingTable">
                <Head>
                    <Row>
                        <Cell class="header" colspan=6>{prefix} Win Percentages Rankings</Cell>
                    </Row>
                    <Row>
                        <Cell class="header"></Cell>
                        <Cell class="header">Manager</Cell>
                        <Cell class="header">Win %</Cell>
                        <Cell class="header">W</Cell>
                            {#if showTies}
                                <Cell class="header">T</Cell>
                            {/if}
                        <Cell class="header">L</Cell>	   
                    </Row>
                </Head>
                <Body>
                    {#each winPercentages as winPercentage, ix}
                        <Row>
                            <Cell>{ix + 1}</Cell>
                            <Cell class="cellName" on:click={() => gotoManager(winPercentage.recordManID)}>
                                {winPercentage.manager.realname}
                                {#if !allTime}
                                    <div class="fantasyTeamName">({winPercentage.manager.name})</div>
                                {/if}
                            </Cell>
                            <Cell class="center">{winPercentage.percentage}%</Cell>
                            <Cell class="center">{winPercentage.wins}</Cell>
                                {#if showTies}
                                    <Cell class="center">{winPercentage.ties}</Cell>
                                {/if}
                            <Cell class="center">{winPercentage.losses}</Cell>			
                        </Row>
                    {/each}
                </Body>
            </DataTable>
        </div>

        <div class="rankingTableWrapper">
            <DataTable class="rankingTable">
                <Head>
                    <Row>
                        <Cell class="header" colspan=5>
                            {prefix} Fantasy Points Rankings
                        </Cell>
                    </Row>
                    <Row>
                        <Cell class="header"></Cell>
                        <Cell class="header">Manager</Cell>
                        <Cell class="header">PF</Cell>
                        <Cell class="header">PA</Cell>
			            <Cell class="header">PPG</Cell>
                    </Row>
                </Head>
                <Body>
                    {#each fptsHistories as fptsHistory, ix}
                        <Row>
                            <Cell>{ix + 1}</Cell>
                            <Cell class="cellName" on:click={() => gotoManager(fptsHistory.recordManID)}>
                                {fptsHistory.manager.realname}
                                {#if !allTime}
                                    <div class="fantasyTeamName">({fptsHistory.manager.name})</div>
                                {/if}
                            </Cell>
                            <Cell class="center">{fptsHistory.fptsFor}</Cell>
                            <Cell class="center">{fptsHistory.fptsAgainst}</Cell>
			                <Cell class="center">{fptsHistory.fptsPerGame}</Cell>
                        </Row>
                    {/each}
                </Body>
            </DataTable>
        </div>

        <div class="rankingTableWrapper">
            <DataTable class="rankingTable">
                <Head>
                    <Row>
                        <Cell class="header" colspan=4>
                            {prefix} Transaction Totals
                        </Cell>
                    </Row>
                    <Row>
                        <Cell class="header"></Cell>
                        <Cell class="header">Manager</Cell>
                        <Cell class="header">Trades</Cell>
                        <Cell class="header">Waivers</Cell>
                    </Row>
                </Head>
                <Body>
                    {#each transactions as transaction, ix}
                        <Row>
                            <Cell>{ix + 1}</Cell>
                            <Cell class="cellName" on:click={() => gotoManager(transaction.recordManID)}>
                                {transaction.manager.realname}
                                {#if !allTime}
                                    <div class="fantasyTeamName">({transaction.manager.name})</div>
                                {/if}
                            </Cell>
                            <Cell class="center">{transaction.trades}</Cell>
                            <Cell class="center">{transaction.waivers}</Cell>
                        </Row>
                    {/each}
                </Body>
            </DataTable>
        </div>

        <div class="rankingTableWrapper">
            {#if seasonBests && seasonBests.length}
                <DataTable class="rankingTable">
                    <Head>
                        <Row>
                            <Cell class="header" colspan=5>
                                {prefix} {"Team Highest Scoring Seasons"}
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Manager</Cell>
                                {#if allTime}
                                    <Cell class="header">Year</Cell>
                                {/if}
                            <Cell class="header">PF</Cell>
                            <Cell class="header">PPG</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each seasonBests as allTimeSeasonBest, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell class="cellName" on:click={() => gotoManager(allTimeSeasonBest.recordManID)}>
                                    {allTimeSeasonBest.manager.realname}
                                    {#if !allTime}
                                        <div class="fantasyTeamName">({allTimeSeasonBest.manager.name})</div>
                                    {/if}
                                </Cell>
                                    {#if allTime}				
                                        <Cell class="center">{allTimeSeasonBest.year}</Cell>
                                    {/if}
                                <Cell class="center">{round(allTimeSeasonBest.fpts)}</Cell>
                                <Cell class="center">{round(allTimeSeasonBest.fptspg)}</Cell>
                            </Row>
                        {/each}
                    </Body>
                </DataTable>
            {/if}
        </div>

        <div class="rankingTableWrapper">
            {#if seasonWorsts && seasonWorsts.length}
                <DataTable class="rankingTable">
                    <Head>
                        <Row>
                            <Cell class="header" colspan=5>
                                {prefix} {"Team Lowest Scoring Seasons"}
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Manager</Cell>
                            <Cell class="header">Year</Cell>
                            <Cell class="header">PF</Cell>
                            <Cell class="header">PPG</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each seasonWorsts as allTimeSeasonWorst, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell class="cellName" on:click={() => gotoManager(allTimeSeasonWorst.recordManID)}>
                                    {allTimeSeasonWorst.manager.realname}
                                    {#if !allTime}
                                        <div class="fantasyTeamName">({allTimeSeasonWorst.manager.name})</div>
                                    {/if}
                                </Cell>
                                <Cell class="center">{allTimeSeasonWorst.year}</Cell>
                                <Cell class="center">{round(allTimeSeasonWorst.fpts)}</Cell>
                                <Cell class="center">{round(allTimeSeasonWorst.fptspg)}</Cell>
                            </Row>
                        {/each}
                    </Body>
                </DataTable>
            {/if}
        </div>

        <div class="rankingTableWrapper">
            {#if weekBests && weekBests.length}
                <DataTable class="rankingTable">
                    <Head>
                        <Row>
                            <Cell class="header" colspan=5>
                                {prefix} {"Team Highest Scoring Week"}
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Manager</Cell>
                                {#if allTime}
                                    <Cell class="header">Year</Cell>
                                {/if}
                            <Cell class="header">Week</Cell>
                            <Cell class="header">PF</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each weekBests as allTimeWeekBest, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell class="cellName" on:click={() => gotoManager(allTimeWeekBest.recordManID)}>
                                    {allTimeWeekBest.manager.realname}
                                    {#if !allTime}
                                        <div class="fantasyTeamName">({allTimeWeekBest.manager.name})</div>
                                    {/if}
                                </Cell>
                                    {#if allTime}				
                                        <Cell class="center">{allTimeWeekBest.year}</Cell>
                                    {/if}
                                <Cell class="center">{allTimeWeekBest.week}</Cell>
                                <Cell class="center">{round(allTimeWeekBest.fpts)}</Cell>
                            </Row>
                        {/each}
                    </Body>
                </DataTable>
            {/if}
        </div>
	    
        <div class="rankingTableWrapper">
            {#if weekWorsts && weekWorsts.length}
                <DataTable class="rankingTable">
                    <Head>
                        <Row>
                            <Cell class="header" colspan=5>
                                {prefix} {"Team Lowest Scoring Week"}
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Manager</Cell>
                                {#if allTime}
                                    <Cell class="header">Year</Cell>
                                {/if}
                            <Cell class="header">Week</Cell>
                            <Cell class="header">PF</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each weekWorsts as allTimeWeekWorst, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell class="cellName" on:click={() => gotoManager(allTimeWeekWorst.recordManID)}>
                                    {allTimeWeekWorst.manager.realname}
                                    {#if !allTime}
                                        <div class="fantasyTeamName">({allTimeWeekWorst.manager.name})</div>
                                    {/if}
                                </Cell>
                                    {#if allTime}				
                                        <Cell class="center">{allTimeWeekWorst.year}</Cell>
                                    {/if}
                                <Cell class="center">{allTimeWeekWorst.week}</Cell>
                                <Cell class="center">{round(allTimeWeekWorst.fpts)}</Cell>
                            </Row>
                        {/each}
                    </Body>
                </DataTable>
            {/if}
        </div>

        <div class="rankingTableWrapper">
            {#if seasonEPERecords && seasonEPERecords.length}
                <DataTable class="rankingTable">
                    <Head>
                        <Row>
                            <Cell class="header" colspan=8>
                                {prefix} {"Everyone Plays Everyone Stats"}
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Manager</Cell>
                            <Cell class="header">EPE Win %</Cell>
                            <Cell class="header">W</Cell>
                            <!-- {#if showTies} -->
                                <Cell class="header">T</Cell>
                            <!-- {/if} -->
                            <Cell class="header">L</Cell>
                            <Cell class="header">Week W</Cell>
                            <Cell class="header">Week L</Cell>	
                        </Row>
                    </Head>
                    <Body>
                        {#each seasonEPERecords as allTimeEPERecord, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell class="cellName" on:click={() => gotoManager(allTimeEPERecord.recordManID)}>
                                    {allTimeEPERecord.manager.realname}
                                    {#if !allTime}
                                        <div class="fantasyTeamName">({allTimeEPERecord.manager.name})</div>
                                    {/if}
                                </Cell>			
                                <Cell class="center">{round(allTimeEPERecord.epePerc)}%</Cell>
                                <Cell class="center">{allTimeEPERecord.epeW}</Cell>
                                <!-- {#if showTies} -->
                                    <Cell class="center">{allTimeEPERecord.epeT}</Cell>
                                <!-- {/if} -->
                                <Cell class="center">{allTimeEPERecord.epeL}</Cell>
                                <Cell class="center">{allTimeEPERecord.weekWin}</Cell>
                                <Cell class="center">{allTimeEPERecord.weekLoss}</Cell>
                            </Row>
                        {/each}
                    </Body>
                </DataTable>
            {/if}
        </div>

    </div>
</div>

<div class="buttonHolder">
    <Group variant="outlined">
        {#each tables as table, ix}
            <Button class="selectionButtons" on:click={() => curTable = ix} variant="{curTable == ix ? "raised" : "outlined"}">
                <Label>{table}</Label>
            </Button>
        {/each}
    </Group>
</div>

{#if !last}
    <hr />
{/if}
