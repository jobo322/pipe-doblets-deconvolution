

function getName(data) {
    const sourceName = data.meta.USERA2;
    const name = sourceName.replace(/<(.*)>/, '$1')
    return name;
}

module.exports = { getName }