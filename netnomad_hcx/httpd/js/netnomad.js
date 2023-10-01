"use strict";

var local_uri_prefix = "";
if (typeof (KISMET_URI_PREFIX) !== 'undefined')
    local_uri_prefix = KISMET_URI_PREFIX;

/// SOCKETS
let user = "netnomad";
let pass = "123qwe";
let host = "192.168.1.12";
//let host = "localhost" // TODO: Allow this to be configurable by NetNomad users somehow?
//let uri_base = `${host}:2501/netnomad/hcx?user=${user}&password=${pass}`;
let uri_base = `${host}:2501/netnomad/hcx`;
//var ws_hcx = new WebSocket(`ws://${uri_base}`);

/// BUTTON INTERACTION
/// Build the button with a custom callback from its row data.
function buildRowBtn(row) {
    return `
        <button class='hcx_interact' onclick='netnomad.sendRowJSON(event, "${JSON.stringify(row).replace(/"/g, '\\"')}")'>
            HCX Interact
        </button>
    `;
}

/// Send row data (as JSON) to the NetNomad backend and write it to the Tab.
export async function sendRowJSON(event, row_json) {
    // Prevent the row window from popping up.
    event.stopPropagation();

    // Send to backend
    var tab_msg = "";
    try {
        let response = await fetch(`http://${uri_base}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: row_json
        });
        tab_msg = await response.text();
    }
    catch (error) { tab_msg = error; }

    // Write to the Tab
    $('#NetNomadTab').html(`
        <div>
            ROW DATA: (WIP)
            <br><br>
            ${row_json}
            <br><br>
            ${tab_msg}
        </div>
    `);

    console.log(`NetNomad Interaction!`);
    // Push the user to the Tab (this is hardcoded to the 3rd tab)
    $('#ui-id-3').click();
}

function renderButtons(data, type, row, meta) {
    return buildRowBtn(row);
}

function drawPackets(dyncolumn, table, row) {
    var row_id = table.column(dyncolumn.name + ':name').index();
    var match = "td:eq(" + row_id + ")";
    var data = row.data();

    $(match, row.node()).sparkline(simple_rrd, { 
        type: "bar",
        barColor: '#000000',
        nullColor: '#000000',
        zeroColor: '#000000'
    });
    $(match, row.node()).html(buildRowBtn(row));
    
};

// Device Interaction Column.
kismet_ui.AddDeviceColumn('column_netnomad_hcx', {
    sTitle: 'NetNomad HCX',
    field: 'kismet.device.base',
    renderfunc: function(data, type, row, meta) {
        return renderButtons(data, type, row, meta);
    },
    //drawfunc: function(data, type, row) {
    //    return drawPackets(data, type, row);
    //}
});

// Bottom Tab Pane. (WIP)
kismet_ui_tabpane.AddTab({
    id: 'NetNomadTab',
    tabTitle: 'NetNomad',
    createCallback: function(div) {
        div.html("<i>NetNomad data here.</i>");
    }
});

// Highlight NetNomad susceptible devices. (WIP)
kismet_ui.AddDeviceRowHighlight({
    name: "NetNomad Highlights",
    description: "Network can be interacted with from NetNomad.",
    priority: 10,
    defaultcolor: "#33F",
    defaultenable: true,
    fields: [
        'dot11.device/dot11.device.pmkid_packet'
    ],
    selector: function(data) {
        try {
            return 'dot11.device.pmkid_packet' in data && data['dot11.device.pmkid_packet'] != 0;
        } catch (e) {
            return false;
        }
    }
});

// SETTINGS
function createSettings(elem) {
    elem.html(`
        <form id="netnomad_settings_form>
            <label for="dropdown">Select an option:</label>
            <br>
            <select id="dropdown" name="dropdown">
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
            </select>
      
            <br>
      
            <label for="textbox">Enter text:</label>
            <br>
            <input type="text" id="textbox" name="textbox" placeholder="Type something...">
      
            <br>
            <br>
            <input type="submit" value="Submit">
        </form>
    `);
}

// Settings
kismet_ui_settings.AddSettingsPane({
    id: 'netnomad_settings',
    listTitle: 'NetNomad Settings',
    create: function(e) { createSettings(e) },
    //save: function(e) { saveSettings(e) }
});