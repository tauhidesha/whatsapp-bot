/**
 * Base Tool Contract for Zoya V2
 * Enforces the universal interface for all tools.
 */

class BaseTool {
    constructor() {
        if (this.constructor === BaseTool) {
            throw new Error("BaseTool is an abstract class.");
        }
        this.name = this.constructor.name;
        this.description = '';
        this.capability = '';
        this.version = '1.0';
    }

    /**
     * Executes the tool logic.
     * @param {Object} input - Universal Tool Request
     * @param {string} input.conversationId
     * @param {string} input.customerId
     * @param {Object} input.conversationState
     * @param {Object} input.parameters
     * @param {Object} input.metadata
     * @returns {Promise<Object>} Universal Tool Response
     */
    async execute(input) {
        const startTime = Date.now();
        try {
            const data = await this._run(input.parameters, input.conversationState);
            return {
                success: true,
                data,
                metadata: { source: this.name, version: this.version },
                error: null,
                executionTimeMs: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                metadata: { source: this.name, version: this.version },
                error: { code: error.code || 'INTERNAL_ERROR', message: error.message },
                executionTimeMs: Date.now() - startTime
            };
        }
    }

    /**
     * Actual implementation logic (to be overridden).
     * @param {Object} parameters 
     * @param {Object} state 
     */
    async _run(parameters, state) {
        throw new Error("Method '_run' must be implemented.");
    }
}

module.exports = BaseTool;
