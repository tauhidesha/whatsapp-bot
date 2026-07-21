/**
 * Tool Registry for Zoya V2
 */

class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    register(toolInstance) {
        this.tools.set(toolInstance.capability, toolInstance);
    }

    getTool(capability) {
        return this.tools.get(capability);
    }

    getAllTools() {
        return Array.from(this.tools.values());
    }
}

const registry = new ToolRegistry();

// Register tools
registry.register(require('./pricingTool'));
registry.register(require('./bookingAvailabilityTool'));
registry.register(require('./createBookingTool'));
registry.register(require('./updateBookingTool'));
registry.register(require('./studioInfoTool'));
registry.register(require('./promoTool'));
registry.register(require('./notificationTool'));
registry.register(require('./calculateHomeServiceFeeTool'));
registry.register(require('./escalateHumanTool'));

module.exports = registry;
