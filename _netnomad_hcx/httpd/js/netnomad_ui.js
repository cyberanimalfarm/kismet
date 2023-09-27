// Module boilerplate.  This will define a module kismet-plugin-foo-js which
// will instantiate under the global object kismet_plugin_foo.
"use strict";

var local_uri_prefix = "";
if (typeof (KISMET_URI_PREFIX) !== 'undefined')
    local_uri_prefix = KISMET_URI_PREFIX;

// Export a constant value 
export const opt1 = 1;

// Export a function
export const SomeFunction = (a, b) => {
    console.log(a, b);
}

// Highlight WPA RSN PMKID using the Kismet row highlight API
kismet_ui.AddDeviceRowHighlight({
    name: "RSN PMKID",
    description: "Network contains a RSN PMKID packet",
    priority: 10,
    defaultcolor: "#F55",
    defaultenable: true,
    fields: [
        'dot11.device/dot11.device.pmkid_packet'
    ],
    selector: function (data) {
        try {
            return 'dot11.device.pmkid_packet' in data && data['dot11.device.pmkid_packet'] != 0;
        } catch (e) {
            return false;
        }
    }
});


// Add Buttons
var observer;

$(document).on('jspanelloaded', function (event, id) {
    if (id == "datasources") {
        var targetNode = document.getElementById("datasources");

        const config = { attributes: false, childList: true, subtree: true };

        var callback = (mutationList, observer) => {
            for (const mutation of mutationList) {
                if (mutation.target.id == "channels") {
                    if ($(this).find("#chanbuttons").length > 0) {

                        $("#datasources div.accordion").find("#chanbuttons").each(function (index) {
                            if ($(this).find("#first").length == 0) {
                                $(this).prepend(
                                    $('<button>', {
                                        id: "first",
                                        uuid: $(this).attr('uuid')
                                    }).html("First")
                                        .button()
                                        .on('click', function () {
                                            console.log("Example button pushed.")

                                        })
                                );
                            }
                        });
                    }
                }
            }
        };

        // Create an observer instance linked to the callback function
        observer = new MutationObserver(callback);

        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);

        // console.log("Started observing data sources.");
    }
});

$(document).on('jspanelclosed', function (event, id) {
    if (id == "datasources") {
        observer.disconnect();
        // console.log("Stopped observing data sources.");
    }
});