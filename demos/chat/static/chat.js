// Copyright 2009 FriendFeed
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

$(document).ready(function() {
    if (!window.console) window.console = {};
    if (!window.console.log) window.console.log = function() {};

    // 在下面两段代码中，this是一个DOM对象，指的是Form这个DOM节点
    // $(this)是一个JQuery对象
    $("#messageform").live("submit", function() {
        newMessage($(this));
        return false;
    });
    $("#messageform").live("keypress", function(e) {
        if (e.keyCode == 13) {
            newMessage($(this));
            return false;
        }
    });
    // 这里做的作用就是触发input的select事件，即会获得焦点，选中所有文本！
    $("#message").select();
    //   每次poll都会发送一个被阻塞的请求，如果这个请求响应成功了，那么就调用updater的
    // OnSuccess方法，在这个方法中会重新调用poll方法，发起一个阻塞Ajax请求。
    updater.poll();
});

function newMessage(form) {
    var message = form.formToDict();
    var disabled = form.find("input[type=submit]");
    disabled.disable();
    $.postJSON("/a/message/new", message, function(response) {
        updater.showMessage(response);
        if (message.id) {
            //TODO: 这里这部分语句是干嘛用的？
            console.log("Form parent is", form.parent());
            form.parent().remove();
        } else {
            // 这句的作用是选中输入框（让焦点聚集在其上），并把其中的内容清空。
            form.find("input[type=text]").val("").select();
            disabled.enable();
        }
    });
}

function getCookie(name) {
    // 这个document.cookie是分号分隔的Cookie键值对
    // 这里\\b正则的意思是单词边界，详见
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#special-word-boundary
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}

$.postJSON = function(url, args, callback) {
    args._xsrf = getCookie("_xsrf");
    // 这里提交的类型是表单数据(application/x-www-form-urlencoded)，
    // 所以需要用JQuery的param方法将参数对象变成&连接的参数字符串
    $.ajax({
        url: url,
        data: $.param(args),
        dataType: "text",
        type: "POST",
        success: function(response) {
            // 这里这样调用callback的作用是将response从一个JSON字符串变成一个对象
            if (callback) callback(eval("(" + response + ")"));
        },
        error: function(response) {
            console.log("ERROR:", response)
        }
    });
};

$.fn.formToDict = function() {
    var fields = this.serializeArray();
    var json = {}
    for (var i = 0; i < fields.length; i++) {
        json[fields[i].name] = fields[i].value;
    }
    if (json.next) delete json.next;
    return json;
};

$.fn.disable = function() {
    this.enable(false);
    return this;
};

$.fn.enable = function(opt_enable) {
    if (arguments.length && !opt_enable) {
        this.attr("disabled", "disabled");
    } else {
        this.removeAttr("disabled");
    }
    return this;
};

var updater = {
    errorSleepTime: 500,
    cursor: null,

    poll: function() {
        var args = {"_xsrf": getCookie("_xsrf")};
        if (updater.cursor) args.cursor = updater.cursor;
        $.ajax({url: "/a/message/updates", type: "POST", dataType: "text",
                data: $.param(args), success: updater.onSuccess,
                error: updater.onError});
    },

    onSuccess: function(response) {
        console.log("onSuccess: response is ", response);
        try {
            updater.newMessages(eval("(" + response + ")"));
        } catch (e) {
            updater.onError();
            return;
        }
        updater.errorSleepTime = 500;
        window.setTimeout(updater.poll, 0);
    },

    onError: function(response) {
        updater.errorSleepTime *= 2;
        console.log("Poll error; sleeping for", updater.errorSleepTime, "ms");
        window.setTimeout(updater.poll, updater.errorSleepTime);
    },

    newMessages: function(response) {
        // 每个消息都有一个ID，为了防止消息被重复添加
        if (!response.messages) return;
        updater.cursor = response.cursor;
        var messages = response.messages;
        updater.cursor = messages[messages.length - 1].id;
        console.log(messages.length, "new messages, cursor:", updater.cursor);
        for (var i = 0; i < messages.length; i++) {
            updater.showMessage(messages[i]);
        }
    },

    showMessage: function(message) {
        var existing = $("#m" + message.id);
        if (existing.length > 0) return;
        var node = $(message.html);
        node.hide();
        $("#inbox").append(node);
        node.slideDown();
    }
};
