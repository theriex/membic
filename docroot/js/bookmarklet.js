/*global alert: false, confirm: false, console: false, setTimeout: false, window: false, document: false, */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

(function () {
    "use strict";

    var

    display = function () {
        var hid, astyle, html, mordiv, logo, exp = 8;
        mordiv = document.getElementById('myopenreviewsdiv');
        if(!mordiv) {
            mordiv = document.createElement('div');
            mordiv.id = 'myopenreviewsdiv';
            document.body.appendChild(mordiv); }
        mordiv.style.zIndex = "2147483647";
        mordiv.style.display = "block";
        mordiv.style.backgroundColor = "#fffff6";
        logo = "https://myopenreviews.appspot.com/img/remo.png";
        mordiv.style.backgroundImage = "url('" + logo + "')";
        mordiv.style.backgroundRepeat = "no-repeat";
        mordiv.style.color = "#111111";
        mordiv.style.position = "absolute";
        mordiv.style.left = "80px";
        mordiv.style.top = "50px";
        mordiv.style.width = "300px";
        //mordiv.style.height = "80px";
        mordiv.style.padding = "30px 20px 30px 75px";
        mordiv.style.border = "4px solid #ccc";
        hid = "var myopenrevsdiv=document.getElementById('myopenreviewsdiv');" +
            "myopenrevsdiv.style.zIndex='1';" +
            "myopenrevsdiv.style.display='none';";
        astyle="border: 2px solid #ccc; padding:2px; background:#fffff9;" + 
              " font-weight:bold;"
        html = "<a href=\"#\" style=\"" + astyle + "\" onclick=\"" + hid +
            "window.open('http://www.myopenreviews.com?newrev=&url=" +
                          encodeURIComponent(window.location.href) + "');" +
              "\">Post to MyOpenReviews</a>" +
            "&nbsp;&nbsp;&nbsp;&nbsp;" +
            "<a href=\"#\" style=\"" + astyle + "\" onclick=\"" + hid + 
              "\">Cancel</a>";
        //html += "<br/>" +
        //    "<p>This box will disappear in " + exp + " seconds.</p>";
        mordiv.innerHTML = html;
        setTimeout(function () {
            var myopenrevsdiv=document.getElementById('myopenreviewsdiv');
            myopenrevsdiv.style.zIndex='1';
            myopenrevsdiv.style.display='none'; }, exp * 1000);
    };
    

    display();


} () );

