
function extractErrorDetails(error) {
    return error.response? {
        message: error.message,
        status: error.response.status,
        data: error.response.data,
    } : {
        message: error.message,
    };
}

module.exports = {
    extractErrorDetails,
};