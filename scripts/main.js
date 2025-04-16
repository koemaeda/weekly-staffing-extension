(async function () {

    // See: https://github.com/flovogt/ui5-external-library
    sap.ui.loader.config({
        paths: {
            "chrome-extension/weekly-staffing": document.currentScript.getAttribute("data-extension-baseurl")
        }
    });

    // Wait until the Fiori app is loaded
    while (!sap.ui.require("myAssignmentsUi/controller/Page.controller")) {
        await new Promise(r => setTimeout(r, 1000));
    }

    // Inject extension controller
    sap.ui.require([
        "myAssignmentsUi/controller/Page.controller",
        "chrome-extension/weekly-staffing/scripts/PageExtension"
    ], function (PageController, PageExtension) {

        const originalOnInit = PageController.prototype.onInit;
        PageController.prototype.onInit = function() {
            if (originalOnInit)
                originalOnInit.apply(this, arguments);
            this.extWeeklyStaffing = new PageExtension(this);
        }

        // initialize first/current controller instance
        const viewInstance = sap.ui.getCore().byId("application-myAssignmentsUi-Display-component---Page");
        if (viewInstance) {
            const controller = viewInstance.getController();
            controller.extWeeklyStaffing = new PageExtension(controller);
        }
    });

})();
