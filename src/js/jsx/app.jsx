"strict mode";

import React, {Component} from "react";

class App extends React.Component {
    render() {
        return <h1> Hello, world! </h1>;
    }
}

// load the components to main div in index.html
ReactDOM.render(
    <App/>,
    document.getElementById("main")
)