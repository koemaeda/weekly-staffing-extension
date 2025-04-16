sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/Column",
    "sap/m/Label",
    "sap/m/Text",
	"sap/ui/export/library",
	"sap/ui/export/Spreadsheet",
], function (JSONModel, Filter, FilterOperator, Column, Label, Text, exportLibrary, Spreadsheet) {

    const EdmType = exportLibrary.EdmType;

    class PageExtension {

        constructor(controller) {
            this.controller = controller;
            this.initialize();
        }

        async initialize() {
            this.model = new JSONModel({
                busy: true,
                rows: [],
                columns: []
            });
            this.controller.setModel(this.model, "zStaffingExt");

            this.odataModel = this.controller.getModel("oDataV4Model");
            this.assignmentsBinding = this.odataModel.bindList("/AssignmentDetails");
            this.requestsBinding = this.odataModel.bindList("/AssignmentRequestDetails");
            this.resourceBinding = this.odataModel.bindList("/ResourceDetails");

            this.calendar = this.controller.byId("MyPlanningCalendar");

            const fragment = await this.controller.loadFragment({ name: "chrome-extension.weekly-staffing.views.WeeklyStaffing" });
            this.bindTableColumns();
            this.calendar.getParent().addItem(fragment);

            this.calendar.attachEvent("startDateChange", () => this.refresh());
            this.calendar.attachEvent("viewChange", () => this.refresh());
            this.refresh();
        }

        bindTableColumns() {
            this.baseColumns = [
                { label: "Project", propertyName: "projectName", width: "12rem" },
                { label: "Task", propertyName: "projectName", width: "12rem" },
                { label: "Status", propertyName: "assignmentStatus", width: "8rem" }
            ];
            this.controller.byId("zStaffing_Table").bindColumns({
                model: "zStaffingExt",
                path: "/columns",
                factory: (id, context) => new Column({
                    multiLabels: [
                        new Label({ text: context.getProperty("label") }),
                        new Label({ text: context.getProperty("subLabel") })
                    ],
                    width: context.getProperty("width"),
                    template: new Text({
                        width: "100%",
                        text: { model: "zStaffingExt", path: context.getProperty("propertyName") }
                    })
                })
            });
        }

        async refresh() {
            this.model.setProperty("/busy", true);
            const weeks = this.getWeeks();
            this.startDate = weeks[0].startDate;
            this.endDate = weeks[weeks.length-1].endDate;

            // Read data from OData model
            [this.capacities, this.assignments, this.requests] = await Promise.all([
                this.readResourceDetails(this.startDate, this.endDate),
                this.readAssignmentDetails(this.startDate, this.endDate),
                this.readAssignmentRequestDetails()
            ]);

            this.weekTotals = Object.fromEntries(weeks.map(week => [week.startDate, {
                available: this.capacities
                    .filter(cap => _dateFromString(cap.capacityDate) >= _dateFromString(week.startDate) &&
                                   _dateFromString(cap.capacityDate) <= _dateFromString(week.endDate))
                    .reduce((acc, cap) => acc + parseFloat(cap.dayCapacity), 0.0),

                assigned: this.assignments
                    .filter(ass => _dateFromString(ass.assignmentStartDate) >= _dateFromString(week.startDate) &&
                                   _dateFromString(ass.assignmentStartDate) <= _dateFromString(week.endDate))
                    .reduce((acc, ass) => acc + parseFloat(ass.AssignedHours), 0.0),
            }]));

            this.updateTableColumns();
            this.updateTableRows();
            this.model.setProperty("/busy", false);
        }

        updateTableColumns() {
            const weeks = this.getWeeks();
            let columns = [
                // Base/static columns
                { label: "Project", subLabel: "Total (Assigned / Available)", propertyName: "projectName", width: "12rem" },
                { label: "Task", subLabel: "", propertyName: "requestName", width: "12rem" },
                { label: "Status", subLabel: "", propertyName: "assignmentStatus", width: "8rem" },
                // Dynamic columns
                ...weeks.map(week => ({
                    ...week,
                    label: week.startDate,
                    subLabel: `${this.weekTotals[week.startDate].assigned} / ${this.weekTotals[week.startDate].available}`,
                    propertyName: "assigned-" + week.startDate,
                    width: "6rem"
                }))
            ];
            this.model.setProperty("/columns", columns);
        }

        async updateTableRows() {
            const weekColumns = this.model.getProperty("/columns").filter(col => col.startDate);
            let rows = this.requests;
            for (const row of rows) {
                for (const assignment of this.assignments) {
                    if (assignment.resourceRequest_ID === row.resourceRequest_ID) {
                        const assignmentDate = _dateFromString(assignment.assignmentStartDate);
                        for (const column of weekColumns) {
                            if (assignmentDate >= _dateFromString(column.startDate) && assignmentDate <= _dateFromString(column.endDate)) {
                                const assignedHours = parseFloat(assignment.AssignedHours)
                                row[column.propertyName] = (row[column.propertyName] || 0.0) + assignedHours;
                                row.totalStaffed = (row.totalStaffed || 0) + assignedHours;
                            }
                        }
                    }
                }
            }
            rows = rows
                .filter(row => row.totalStaffed > 0)
                .sort((a, b) => a.projectName.localeCompare(b.projectName));
            this.model.setProperty("/rows", rows);
        }

        async readResourceDetails(startDate, endDate) {
            this.resourceBinding.filter(new Filter({ and: true, filters: [
                new Filter("capacityDate", FilterOperator.GE, startDate),
                new Filter("capacityDate", FilterOperator.LE, endDate)
            ] }));
            return (await this.resourceBinding.requestContexts(0, 9999)).map(e => e.getObject());
        }

        async readAssignmentDetails(startDate, endDate) {
            this.assignmentsBinding.filter(new Filter({ and: true, filters: [
                new Filter("assignmentStartDate", FilterOperator.GE, startDate),
                new Filter("assignmentStartDate", FilterOperator.LE, endDate)
            ] }));
            return (await this.assignmentsBinding.requestContexts(0, 9999)).map(e => e.getObject());
        }

        async readAssignmentRequestDetails() {
            return (await this.requestsBinding.requestContexts(0, 9999)).map(e => e.getObject());
        }

        getWeeks() {
            let firstMonday = _dateToString(this.calendar.getStartDate());
            while (_dateFromString(firstMonday).getDay() !== 1) {
                firstMonday = _dateAddDays(firstMonday, -1);
            }

            let weeks = [];
            for (let i=0; i<365; i+=7) { // max = 1 year
                const monday = _dateAddDays(firstMonday, i);
                const sunday = _dateAddDays(firstMonday, i + 6);

                // All date comparisons are done from string values (e.g. "2025-04-21"),
                //  so all dates are local dates and timezones can be completely ignored.
                weeks.push({
                    startDate: monday,
                    endDate: sunday,
                });
            }
            return weeks;
        }

        async downloadSpreadsheet() {
            if (this.extWeeklyStaffing) // called from Controller context
                return this.extWeeklyStaffing.downloadSpreadsheet();

            const excelColumns = this.model.getProperty("/columns").map(column => ({
                label: column.label,
                property: column.propertyName,
                width: column.width,
                wrap: true,
                type: column.startDate ? EdmType.Number : EdmType.String,
                scale: column.startDate ? 0 : undefined
            }));
            const sheet = new Spreadsheet({
                workbook: {
                    columns: excelColumns,
                    hierarchyLevel: "Level"
                },
                dataSource: this.controller.byId("zStaffing_Table").getBinding("rows"),
                fileName: `Staffing ${this.startDate}.xlsx`,
            });
            await sheet.build();
            sheet.destroy();
        }

    }

    // conversions for local ISO8601 dates, e.g. 2025-04-21
    function _dateToString(date) {
        return date.toISOString().split("T")[0];
    }
    function _dateFromString(str) {
        return new Date(str + "T00:00:00");
    }
    function _dateAddDays(str, days) {
        let temp = _dateFromString(str);
        temp.setUTCDate(temp.getUTCDate() + days);
        return _dateToString(temp);
    };

    return PageExtension;
});