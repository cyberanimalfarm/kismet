#!/usr/bin/env python3

# A very basic example of how to create a python-native extension to Kismet
# that interfaces over the external API
#
# This uses the python_tools/KismetExternal python module to integrate with 
# the eventbus and print events to the console.

import argparse
import os
import time
import sys
import threading

# Pretty-print the failure
try:
    import kismetexternal
except ImportError:
    print("ERROR:  Kismet external Python tools require the kismetexternal python ")
    print("        library; you can find it in the kismetexternal git or via pip")
    sys.exit(1)

class KismetProxyTest(object):
    def __init__(self):
        # Try to parse the arguments to find the descriptors we need to give to 
        # the kismet external tool; Kismet calls external helpers with a pre-made
        # set of pipes on --in-fd and --out-fd
        self.parser = argparse.ArgumentParser(description='NetNomad Backend')

        self.parser.add_argument('--in-fd', action="store", type=int, dest="infd")
        self.parser.add_argument('--out-fd', action="store", type=int, dest="outfd")
        # self.parser.add_argument('--user', action="store", type=str, dest="user", default="netnomad")
        # self.parser.add_argument('--password', action="store", type=str, dest="password", default="123qwe")

        self.results = self.parser.parse_args()

        if self.results.infd is None or self.results.outfd is None:
            print("ERROR:  Kismet external python tools are (typically) launched by ")
            print("        Kismet itself; running it on its own won't do what you want")
            sys.exit(1)

        print("NN: Eventbus loaded KismetExternal {}".format(kismetexternal.__version__))
        print(f"NN: Kismet Config\n{self.results}")

        # Initialize our external interface
        self.kei = kismetexternal.ExternalInterface(self.results) 

        # Start the external handler BEFORE we register our handlers, since we need to be
        # connected to send them!
        self.kei.start()

        self.kei.request_http_auth(self.handle_web_auth_token)
        
        # Register a URI handler to handle events from the NetNomad frontend.
        self.hcx_uri = "/netnomad/hcx"
        self.kei.add_uri_handler("POST", self.hcx_uri, self.handle_hcx_interact)

        # Register an event handler for all events
        # self.kei.add_event_handler("*", self.handle_event)        

        self.kei.debug = True

        # Start the IO loops running
        self.kei.run()


    def handle_web_auth_token(self):
        print("NN: NetNomad got HTTP auth token", self.kei.auth_token)

    def handle_event(self, event, dictionary):
        #print("Eventbus got {}".format(event))
        pass

    def handle_hcx_interact(self, handler, request):
        print(f"NN: NetNomad got {request.uri}")
        handler.send_http_response(request.req_id, bytes("Working an HCX interaction!", "UTF-8"))

    # Loop forever
    def loop(self):
        while self.kei.is_running():
            self.kei.send_ping()
            time.sleep(1)

        self.kei.kill()


if __name__ == "__main__":
    # Make a proxytest and loop forever
    pt = KismetProxyTest()

    # Loop in a detached process
    pt.loop()
