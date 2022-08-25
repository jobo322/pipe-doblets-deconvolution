

function groupExperiments(experiments) {
    if (experiments.length < 2) return [experiments];

    experiments.sort((exp1, exp2) => exp1.expno - exp2.expno);

    let groups = [];
    let group = [experiments[0]];
    for (let i = 1; i < experiments.length; i++) {
        const experiment = experiments[i];
        if (experiment.expno < 10000) {
            const diff = Math.abs(experiment.expno - group[0].expno);
            if (diff < 2) {
                group.push(experiment);
            } else if (diff > 4) {
                groups.push([...group]);
                group = [experiments[i]];
            }
        }
        if (i === experiments.length - 1) {
            groups.push([...group]);
        }
    }

    if (groups[groups.length - 1].length !== group.length) {
        groups.push(group);
    }

    return groups;
}

module.exports = { groupExperiments };