sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    class PageExtension {

        constructor(controller) {
            this.controller = controller;
            this.initialize();
        }

        async initialize() {
            this.model = new JSONModel({
                dateString: "",
                warningVisible: false,
                totalsVisible: false,
                totals: [],
            });

            this.controller.setModel(this.model, "zStaffingExt");

            this.calendar = this.controller.byId("MyPlanningCalendar");

            const fragment = await this.controller.loadFragment({ name: "chrome-extension.weekly-staffing.views.Totals" });
            this.calendar.getParent().insertItem(fragment, 0);

            this.calendar.attachEvent("startDateChange", () => this.updateTotals());
            this.calendar.attachEvent("viewChange", () => this.updateTotals());
            this.updateInterval = setInterval(() => this.updateTotals(), 1000); // no reliable way to capture when data changed

            this.navigateToCurrentMonday();
        }

        async cleanup() {
            clearInterval(this.updateInterval);
        }

        async updateTotals() {
            // only display totals if on Weekly view and current date is a Monday
            const selectedDate = this.calendar.getStartDate();
            if (this.calendar.getViewKey() !== "MyWeek" || selectedDate.getDay() !== 1) {
                this.model.setProperty("/totals", []);
                this.model.setProperty("/warningVisible", true);
                this.model.setProperty("/totalsVisible", false);
                return;
            }
            this.model.setProperty("/warningVisible", false);
            this.model.setProperty("/totalsVisible", true);
            this.model.setProperty("/dateString", selectedDate.toLocaleDateString());

            const appointments = this.calendar.getRows()
                .flatMap(e => e.getAppointments())
                .map(e => this.calendar.getModel().getProperty(e.getBindingContext().getPath()))
                .map(e => ({
                    ...e,
                    staffedHours: parseInt(e.staffedHours, 10)
                }));

            const map = {};
            for (const app of appointments) {
                if (map[app.assignmentId])
                    map[app.assignmentId].staffedHours += app.staffedHours;
                else
                    map[app.assignmentId] = app;
            }
            const totals = Object.keys(map)
                .map(key => map[key])
                .sort((a, b) => b.staffedHours - a.staffedHours);
            totals.push({
                projectName: "Total",
                staffedHours: totals.reduce((acc, curr) => acc + curr.staffedHours, 0)
            });
            this.model.setProperty("/totals", totals);
        }

        navigateToCurrentMonday() {
            const now = new Date();
            const diff = (now.getDay() - 1) * (24 * 60 * 60 * 1000);
            const currentMonday = new Date(now.getTime() - diff);
            this.calendar.setViewKey("MyWeek");
            this.calendar.setStartDate(currentMonday);
            this.calendar.fireViewChange();
        }
    }

    return PageExtension;
});