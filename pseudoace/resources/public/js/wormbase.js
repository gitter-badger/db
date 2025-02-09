/*!
 * WormBase
 * http://wormbase.org/
 *
 * WormBase copyright © 1999-2011
 * California Institute of Technology,
 * Ontario Institute for Cancer Research,
 * Washington University at St. Louis, and
 * The Wellcome Trust Sanger Institute.
 *
 * WormBase is supported by a grant from the
 * National Human Genome Research Institute at the
 * US National Institutes of Health # P41 HG02223 and the
 * British Medical Research Council.
 *
 * author: Abigail Cabunoc
 *         abigail.cabunoc@oicr.on.ca
 */


+function(window, document, undefined){
  var location = window.location,
      $jq = jQuery.noConflict();

  var WB = (function(){
    var timer,
        notifyTimer,
        cur_search_type = 'all',
        cur_search_species_type = '',
        body = $jq("#wrap"),
        reloadLayout = 0, //keeps track of whether or not to reload the layout on hash change
        loadcount = 0;

    function init(){
      var pageInfo = $jq("#header").data("page"),
          searchAll = $jq("#all-search-results"),
          sysMessage = $jq("#top-system-message").children(".system-message-close"),
          history_on = (pageInfo['history'] === '1') ? 1 : undefined;
      if(history_on){
        $jq.post("/rest/history", { 'ref': pageInfo['ref'] , 'name' : pageInfo['name'], 'id':pageInfo['id'], 'class':pageInfo['class'], 'type': pageInfo['type'], 'is_obj': pageInfo['is_obj'] });
      }

      if($jq(".user-history").size()>0){
        histUpdate(history_on);
      }


      search_change(pageInfo['class']);
      if(sysMessage.size()>0) {systemMessage('show'); sysMessage.click(function(){ systemMessage('hide', sysMessage.data("id")); });}

      comment.init(pageInfo);
      issue.init(pageInfo);


      updateCounts(pageInfo['ref']);
      if(pageInfo['notify']){ displayNotification(pageInfo['notify']); }

      navBarInit();
      pageInit();

      if(searchAll.size()>0) {
        var searchInfo = searchAll.data("search");
        allResults(searchInfo['type'], searchInfo['species'], searchInfo['query']);
      } else {
        if($jq(".star-status-" + pageInfo['wbid']).size()>0){$jq(".star-status-" + pageInfo['wbid']).load("/rest/workbench/star?wbid=" + pageInfo['wbid'] + "&name=" + pageInfo['name'] + "&class=" + pageInfo['class'] + "&type=" + pageInfo['type'] + "&id=" + pageInfo['id'] + "&url=" + pageInfo['ref'] + "&save_to=" + pageInfo['save'] + "&is_obj=" + pageInfo['is_obj']);}
        widgetInit();
      }
      effects();
      Plugin.getPlugin("placeholder", function(){
        $jq('input, textarea').placeholder();
      });

      if($jq(".lightbox").size()){
        WB.getPlugin("colorbox", function(){
          $jq(".lightbox").colorbox();
        });
      }
    }


    function histUpdate(history_on){
      var uhc = $jq("#user_history-content");

      ajaxGet($jq(".user-history"), "/rest/history?sidebar=1");
      if(uhc.size()>0 && uhc.text().length > 4) ajaxGet(uhc, "/rest/history");
      if(history_on){
        setTimeout(histUpdate, 6e5); //update the history every 10min
      }
      reloadWidget('activity');
      return;
    }

    function ajaxError(xhr){
          var error = xhr.responseText && $jq(xhr.responseText.trim()).find(".error-message-technical").html() || '',
              statusText = ((xhr.statusText ===  'timeout') && xhr.requestURL) ? 'timeout: <a href="' + xhr.requestURL + '" target="_blank">try going to the widget directly</a>': xhr.statusText;
          return '<div class="ui-state-error ui-corner-all"><p><strong>Sorry!</strong> An error has occured.</p>'
                  + '<p><a href="/tools/support?url=' + location.pathname
                  + (error ? '&msg=' + encodeURIComponent(error.trim()) : '')
                  + '">Let us know</a></p><p>' + error + '</p><p>' + statusText + '</p></div>';
    }

    function navBarInit(){
      searchInit();
      $jq("#nav-bar").find("ul li").hover(function () {
          var navItem = $jq(this);
          $jq("div.columns>ul").hide();
          if(timer){
            navItem.siblings("li").children("ul.wb-dropdown").hide();
            navItem.siblings("li").children("a").removeClass("hover");
            navItem.children("ul.wb-dropdown").find("a").removeClass("hover");
            navItem.children("ul.wb-dropdown").find("ul.wb-dropdown").hide();
            clearTimeout(timer);
            timer = undefined;
          }
          navItem.children("ul.wb-dropdown").show();
          navItem.children("a").addClass("hover");
        }, function () {
          var toHide = $jq(this);
          if(timer){
            clearTimeout(timer);
            timer = undefined;
          }
          timer = setTimeout(function() {
                toHide.children("ul.wb-dropdown").hide();
                toHide.children("a").removeClass("hover");
              }, 300)
        });

        ajaxGet($jq(".status-bar"), "/rest/auth", undefined, function(){
          $jq("#bench-status").load("/rest/workbench");
          var login = $jq("#login");
          if(login.size() > 0){
            login.click(function(){
              $jq(this).toggleClass("open ui-corner-top").siblings().toggle();
            });
          }else{
            $jq("#logout").click(function(){
              window.location = "/logout?redirect=" + window.location;
            });
          }
        });
    }

    function pageInit(){
      var personSearch = $jq("#person-search"),
          colDropdown = $jq("#column-dropdown");

      operator();

      $jq("#print").click(function() {
        var layout = location.hash.replace('#',''),
            print = $jq(this);
          $jq.ajax({
              type: "POST",
              url : '/rest/print',
              data: {layout:layout},
              beforeSend:function(){
                setLoading(print);
              },
              success: function(data){
                print.html('');
                location.href=data;
              },
              error: function(xhr,status,error) {
                print.html(ajaxError(xhr));
              }
            });
      });

      $jq(".section-button").click(function() {
          var section = $jq(this).attr('wname');
          $jq("#nav-" + section).trigger("open");
          Scrolling.goToAnchor(section);
      });

      if($jq(".sortable").size()>0){
        $jq(".sortable").sortable({
          handle: '.widget-header, #widget-footer',
          items:'li.widget',
          placeholder: 'placeholder',
          connectWith: '.sortable',
          opacity: 0.6,
          forcePlaceholderSize: true,
          update: function(event, ui) { Layout.updateLayout(); }
        });
      }


      colDropdown.hover(function () {
          if(timer){
            $jq("#nav-bar").find("ul li .hover").removeClass("hover");
            $jq("#nav-bar").find("ul.wb-dropdown").hide();
            clearTimeout(timer);
            timer = undefined;
          }
          colDropdown.children("ul").show();
        }, function () {
          if(timer){
            clearTimeout(timer);
            timer = undefined;
          }
          if(colDropdown.find("#layout-input:focus").size() === 0){
            timer = setTimeout(function() {
                  colDropdown.children("ul").hide();
                }, 300)
          }else{
            colDropdown.find("#layout-input").blur(function(){
              timer = setTimeout(function() {
                  colDropdown.children("ul").hide();
                }, 600)
            });
          }
        });

      $jq("#nav-min").click(function() {
        var nav = $jq(".navigation-min").add("#navigation"),
            ptitle = $jq("#page-title"),
            w = nav.width(),
            msg = "open sidebar",
            marginLeft = '-1em';
        if(w === 0){ w = '12em'; msg = "close sidebar"; marginLeft = 175; }else { w = 0;}
        nav.stop(false, true).animate({width: w}).show().children("#title").toggleClass("closed").children("div").toggle();
        ptitle.stop(false, true).animate({marginLeft: marginLeft}).show();
        $jq(this).attr("title", msg).children("#nav-min-icon").toggleClass("ui-icon-triangle-1-w ui-icon-triangle-1-e");
        Layout.updateLayout();
        body.toggleClass("sidebar-hidden");
      });

      // Should be a user supplied site-wide option for this.
      // which can be over-ridden on any widget.
      // Toggle should empty look of button
      $jq("#hide-empty-fields").click(function() {
            body.toggleClass("show-empty");
      });

      if(personSearch.size()>0){
          ajaxGet(personSearch, personSearch.attr("href"), undefined, function(){
            checkSearch(personSearch);
            personSearch.delegate(".results-person .result li a", 'click', function(){
                $jq(".ui-state-highlight").removeClass("ui-state-highlight");
                var wbid = $jq(this).attr("href").split('/').pop();
                $jq.ajax({
                    type: "GET",
                    url: "/auth/info/" + wbid,
                    dataType: 'json',
                    success: function(data){
                          var linkAccount = $jq("#link-account");
                          if(linkAccount.size()===0){
                            $jq("input#name").attr("value", data.fullname).attr("disabled", "disabled");
                            var email = new String(data.email);
                            if(data.email && data.status_ok){
                              var re = new RegExp($jq("input#email").val(),"gi");
                              if (((email.match(re))) || !($jq("input#email").val())){
                                $jq("#email").attr("disabled", "disabled").parent().hide();
                              }
                              $jq("input#wbemail").attr("value", email).parent().show();
                            }else{
                              $jq("input#wbemail").attr("value", "").parent().hide();
                              $jq("#email").removeAttr("disabled").parent().show();
                            }
                            $jq(".register-notice").html("<span id='fade'>" +  data.message + "</span>").show();
                            $jq("input#wbid").attr("value", data.wbid);
                          }else{
                            $jq("input#wbid").attr("value", data.wbid);
                            $jq("input#email").attr("value", data.email);
                            linkAccount.removeAttr("disabled");
                            $jq("input#confirm").attr("value", "");
                            var emails = ["[% emails.join('", "') %]"];
                            if(data.email && data.status_ok){
                              var e = "" + data.email;
                              for(var i=0; i<emails.length; i++){
                                var re = new RegExp(emails[i],"gi");
                                if (e.match(re)){
                                  $jq(".register-notice").css("visibility", "hidden");
                                  $jq("input#confirm").attr("value", 1);
                                  return;
                                }
                              }
                            }else{
                              linkAccount.attr("disabled", 1);
                            }
                            $jq(".register-notice").html("<span id='fade'>" +  data.message + "</span>").css("visibility", "visible");

                          }
                      },
                    error: function(xhr,status,error) {
                        $jq(".error").prepend(ajaxError(xhr));
                      }
                });
                $jq(this).parent().parent().addClass("ui-state-highlight");
                return false;
            });
          });
      }
    }




    function widgetInit(){
      var widgetHolder = $jq("#widget-holder"),
          widgets = $jq("#widgets"),
          listLayouts = $jq(".list-layouts"),
          layout;
      if(widgetHolder.size()===0){
        $jq("#content").addClass("bare-page");
        return;
      }
      Scrolling.sidebarInit();

      window.onhashchange = Layout.readHash;
      window.onresize = Layout.resize;
      Layout.Breadcrumbs.init();
      if(location.hash.length > 0){
        Layout.readHash();
      }else if(layout = widgetHolder.data("layout")){
        Layout.resetPageLayout(layout);
      }else{
        Layout.openAllWidgets();
      }

//       if(listLayouts.children().size()==0){ajaxGet(listLayouts, "/rest/layout_list/"  + $jq(".list-layouts").data("class") + "?section=" + $jq(".list-layouts").data("section"));}

      // used in sidebar view, to open and close widgets when selected
      widgets.find(".module-load").click(function() {
        var widget_name = $jq(this).attr("wname"),
            nav = $jq("#nav-" + widget_name),
            content = $jq("#" + widget_name + "-content");
        if(!nav.hasClass('ui-selected')){
          if(content.text().length < 4){
              var column = ".left",
                  lWidth = Layout.getLeftWidth(widgetHolder);
              if(lWidth >= 90){
                if(widgetHolder.children(".right").children(".visible").height()){
                  column = ".right";
                }
              }else{
                var leftHeight = height(widgetHolder.children(".left").children(".visible"));
                    rightHeight = height(widgetHolder.children(".right").children(".visible"));
                if (rightHeight < leftHeight){ column = ".right"; }
              }
              openWidget(widget_name, nav, content, column);
          }else{
            content.parents("li").addClass("visible");
            nav.addClass("ui-selected");
            moduleMin(content.prev().find(".module-min"), false, "maximize");
          }
        }
        Scrolling.goToAnchor(widget_name);
        Layout.updateLayout();
        Scrolling.sidebarMove();
        return false;
      });



          // used in sidebar view, to open and close widgets when selected
      widgets.find(".module-close").click(function() {
        var widget_name = $jq(this).attr("wname"),
            nav = $jq("#nav-" + widget_name),
            content = $jq("#" + widget_name + "-content");

          Scrolling.scrollUp(content.parents("li"));
          moduleMin(content.prev().find(".module-min"), false, "minimize", function(){
            nav.removeClass("ui-selected");
            content.parents("li").removeClass("visible");
            Layout.updateLayout();
          });

        Scrolling.sidebarMove();
        return false;
      });


      function height(list){
        var len = 0;
        for(var i=-1, l = list.length; i++<l;){
          len += list.eq(i).height();
        }
        return len;
      }







      widgetHolder.children("#widget-header").disableSelection();

      widgetHolder.find(".module-max").click(function() {
        var module = $jq(this).parents(".widget-container"),
    //     if(module.find(".cboxElement").trigger('click').size() < 1){
            clone = module.clone(),
    //       clone.find(".module-max").remove();
    //       clone.find(".module-close").remove();
    //       clone.find(".module-min").remove();
    //       clone.find("#widget-footer").remove();
    //       clone.find("h3").children(".ui-icon").remove();
    //       clone.css("min-width", "400px");
    //       var cbox = $jq('<a class="cboxElement" href="#"></a>');
    //       cbox.appendTo(module).hide();
    //       cbox.colorbox({html:clone, title:"Note: not all effects are supported while widget is maximized", maxWidth:"100%"}).trigger('click');
    //     }

    // code for external pop out window - if we need that
          popout = window.open("", "test", "height=" + module.height() + ",width=" + module.width());
        popout.document.write(document.head.innerHTML);
        popout.document.write(clone.html());
      });

      // used in sidebar view, to open and close widgets when selected
      widgets.find(".module-load, .module-close").bind('open',function() {
        var widget_name = $jq(this).attr("wname"),
            nav = $jq("#nav-" + widget_name),
            content = $jq("#" + widget_name + "-content");

        openWidget(widget_name, nav, content, ".left");
        return false;
      });

      widgetHolder.find(".module-min").click(function() {
        moduleMin($jq(this), true);
      });



      widgetHolder.find(".reload").click(function() {
        reloadWidget($jq(this).attr("wname"));
      });

      $jq(".feed").click(function() {
        var url=$jq(this).attr("rel"),
            div=$jq(this).parent().next("#widget-feed");
        div.filter(":hidden").empty().load(url);
        div.slideToggle('fast');
      });
    }

    function effects(){
      var content = $jq("#content");
      $jq("body").delegate(".toggle", 'click', function(){
            var tog = $jq(this);
            tog.toggleClass("active").next().slideToggle("fast", function(){
                if($jq.colorbox){ $jq.colorbox.resize(); }
                Scrolling.sidebarMove();
              });
            if(tog.hasClass("load-toggle")){
              ajaxGet(tog.next(), tog.attr("href"));
              tog.removeClass("load-toggle");
            }
            tog.children(".ui-icon").toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
            return false;
      });

      content.delegate(".evidence", 'click', function(){
        var ev = $jq(this);
        ev.children(".ev-more").toggleClass('open').children('.ui-icon').toggleClass('ui-icon-triangle-1-s ui-icon-triangle-1-n');
        ev.children(".ev").toggle('fast');
      });

      content.delegate(".slink", 'mouseover', function(){
          var slink = $jq(this);
          Plugin.getPlugin("colorbox", function(){
            slink.colorbox({data: slink.attr("href"),
                            width: "800px",
                            height: "550px",
                            scrolling: false,
                           onComplete: function() {$jq.colorbox.resize(); },
                            title: function(){ return slink.next().text() + " " + slink.data("class"); }});
          });
      });

      content.delegate(".bench-update", 'click', function(){
        var update = $jq(this),
            wbid = update.attr("wbid"),
            save_to = update.attr("save_to"),
            url = update.attr("ref") + '?name=' + escape(update.attr("name")) + "&url=" + escape(update.attr("href")) + "&save_to=" + save_to + "&is_obj=" + update.attr("is_obj");
        $jq(".star-status-" + wbid).find("#save").toggleClass("ui-icon-star-yellow ui-icon-star-gray");
        $jq("#bench-status").load(url, function(){
          if($jq("div#" + save_to + "-content").text().length > 3){
            reloadWidget(save_to, 1);
          }
        });
        return false;
      });

      $jq("body").delegate(".generate-file-download", 'click', function(e){
          var filename = $jq(this).find("#filename").text(),
              content = $jq(this).find("#content").text();
          Plugin.getPlugin("generateFile", function(){
          $jq.generateFile({
              filename    : filename,
              content     : content,
              script      : '/rest/download'
          });
        });
      });

    }

    function moduleMin(button, hover, direction, callback) {
      var module = $jq("#" + button.attr("wname") + "-content");

      if (direction && (button.attr("title") !== direction) ){ if(callback){ callback()} return; }
      module.slideToggle("fast", function(){Scrolling.sidebarMove(); if(callback){ callback()}});
      button.toggleClass("ui-icon-triangle-1-s ui-icon-triangle-1-e").closest(".widget-container").toggleClass("minimized");
      if(hover)
        button.toggleClass("ui-icon-circle-triangle-e ui-icon-circle-triangle-s");
      (!button.hasClass("show")) ? button.attr("title", "maximize").addClass("show") : button.attr("title", "minimize").removeClass("show");

      Layout.updateLayout();
    }


    function displayNotification (message){
        if(notifyTimer){
          clearTimeout(notifyTimer);
          notifyTimer = undefined;
        }
        var notification = $jq("#notifications");
        notification.show().children("#notification-text").text(message);

        notifyTimer = setTimeout(function() {
              notification.fadeOut(400);
            }, 3e3)

        notification.click(function() {
          if(notifyTimer){
            clearTimeout(notifyTimer);
            notifyTimer = undefined;
          }
          $jq(this).hide();
        });
    }



   function systemMessage(action, messageId){
     var systemMessage = $jq(".system-message"),
         notifications = $jq("#notifications");
      if(action === 'show'){
//         systemMessage.show().css("display", "block").animate({height:"20px"}, 'slow');
        notifications.css("top", "20px");
        Scrolling.set_system_message(20);
      }else{
        systemMessage.animate({height:"0px"}, 'slow', undefined,function(){ $jq(this).hide();});
        $jq.post("/rest/system_message/" + messageId);
        Scrolling.set_system_message(0);
        notifications.css("top", "0");
      }
  }


    function setLoading(panel) {
      panel.html('<div class="loading"><img src="/img/ajax-loader.gif" alt="Loading..." /></div>');
    }

    function ajaxGet(ajaxPanel, $url, noLoadImg, callback) {
      $jq.ajax({
        url: $url,
        beforeSend:function(xhr){
          if(!noLoadImg){ setLoading(ajaxPanel); }
          xhr.requestURL = $url;
        },
        success:function(data){
          ajaxPanel.html(data);
        },
        error:function(xhr, textStatus, thrownError){
          ajaxPanel.html(ajaxError(xhr));
        },
        complete:function(XMLHttpRequest, textStatus){
          if(callback){ callback(); }
        }
      });
    }

      function operator(){

        $jq("#issue-box-tab").click(function(){
          var isBox = $jq(this).parent();
          isBox.toggleClass("minimize");//.children().toggle();
          // isBox.animate({width: (isBox.hasClass("minimize")) ? "1em" : "14em"})
        });
    }





    /***************************/
    // Search Bar functions
    // author: Abigail Cabunoc
    // abigail.cabunoc@oicr.on.ca
    /***************************/

    //The search bar methods
    function searchInit(){
      var searchBox = $jq("#Search"),
          searchBoxDefault = "search...",
          searchForm = $jq("#searchForm"),
          lastXhr;

      searchBox.focus(function(e){
        $jq(this).addClass("active");
      });
      searchBox.blur(function(e){
        $jq(this).removeClass("active");
      });

      searchBox.autocomplete({
          source: function( request, response ) {
              lastXhr = $jq.getJSON( "/search/autocomplete/" + cur_search_type, request, function( data, status, xhr ) {
                  if ( xhr === lastXhr ) {
                      response( data );
                  }
              });
          },
          minLength: 2,
          select: function( event, ui ) {
              location.href = ui.item.url;
          }
      });


    }



    function search(box) {
        if(!box){ box = "Search"; }else{ cur_search_type = cur_search_type || 'all'; }
        var f = $jq("#" + box).val();
        if(f === "search..." || !f){
          f = "";
        }

        f = encodeURIComponent(f.trim());
        f = f.replace('%26', '&');
        f = f.replace('%2F', '/');

        location.href = '/search/' + cur_search_type + '/' + f + (cur_search_species_type ? '?species=' + cur_search_species_type : '');
    }

    function search_change(new_search) {
      if(!new_search) { new_search = 'gene';}
      cur_search_type = new_search;
      if(new_search === "all"){
      new_search = "for anything";
      }else{
        var search_for = "for a";
        if(new_search.match(/^[aeiou]/)){
          search_for = search_for + "n";
        }
        new_search = search_for + " " + new_search.replace(/[_]/, ' ');
      }

      $jq(".current-search").text(new_search);
    }


    function search_species_change(new_search) {
      cur_search_species_type = new_search;
      if(new_search === "all"){
      new_search = "all species";
      }else{
        new_search = new_search.charAt(0).toUpperCase() + new_search.slice(1);
        new_search = new_search.replace(/[_]/, '. ');
      }
      $jq(".current-species-search").text(new_search);
    }



  function checkSearch(div){
    var results = div.find("#results"),
        searchData = (results.size() > 0) ? results.data("search") : undefined;
    if(!searchData){ formatExpand(results); return; }
    SearchResult(searchData['query'], searchData["type"], searchData["species"], searchData["widget"], searchData["nostar"], searchData["count"], div);
  }

  function formatExpand(div){
      var expands = div.find(".text-min");
      for(var i=-1, el, l = expands.size(); ((el = expands.eq(++i)) && i < l);){
        if (el.height() > 35){
          el.html('<div class="text-min-expand">' + el.html() + '</div><div class="more"><div class="ui-icon ui-icon-triangle-1-s"></div></div>')
            .click(function(){
            var container = $jq(this),
                txt = container.children(".text-min-expand");
            txt.animate({height:(txt.height() < 40) ? '100%' : '2.4em'})
               .css("max-height", "none")
               .next().toggleClass('open').children()
               .toggleClass('ui-icon-triangle-1-s ui-icon-triangle-1-n');
            container.parent().find(".expand").toggleClass('ellipsis');
          });
        }
      }
  }

  function SearchResult(q, type, species, widget, nostar, t, container){
    var query = decodeURI(q),
        page = 1.0,
        total = t,
        resultDiv = container.find((widget ? "." + widget + "-widget " : '') + ".load-results"),
        queryList = query ? query.replace(/[,\.\*]|%22|%27/g, ' ').split(' ') : [];

    function init(){
      container.find("#results").find(".load-star").each(function(){
        $jq(this).load($jq(this).attr("href"));
      });
    }


    function formatResults(div){
      formatExpand(div);

      if(queryList.length === 0) { return; }
      Plugin.getPlugin("highlight", function(){
        for (var i=0; i<queryList.length; i++){
          if(queryList[i]) { div.highlight(queryList[i]); }
        }
      });
    }

    formatResults(container.find("div#results"));
    init();

    if(total > 10 || !total){
      if(container.find(".lazyload-widget").size() > 0){ Scrolling.search(); }
      resultDiv.click(function(){
        var url = $jq(this).attr("href") + (page + 1) + "?" + (species ? "species=" + species : '') + (widget ? "&widget=" + widget : '') + (nostar ? "&nostar=" + nostar : '');
            div = $jq("<div></div>"),
            res = $jq((widget ? "." + widget + "-widget" : '') + " #load-results");

        $jq(this).removeClass("load-results");
        page++;

        setLoading(div);

        res.html("loading...");
        div.load(url, function(response, status, xhr) {
          total = div.find("#page-count").data("count") || total;
          var left = total - (page*10);
          if(left > 0){
            if(left>10){left=10;}
            res.addClass("load-results");
            res.html("load " + left + " more results");
          }else{
            res.remove();
          }

          formatResults(div);

          if (status === "error") {
            var msg = "Sorry but there was an error: ";
            $jq(this).html(msg + xhr.status + " " + xhr.statusText);
          }
          Scrolling.sidebarMove();

          div.find(".load-star").each(function(){
            $jq(this).load($jq(this).attr("href"));
          });
        });

        div.appendTo($jq(this).parent().children("ul"));
        loadcount++;
        Scrolling.sidebarMove();
      });
    }

  } //end SearchResult

  function loadResults(url){
    var allSearch = $jq("#all-search-results");
    allSearch.empty();
    ajaxGet(allSearch, url, undefined, function(){
      checkSearch(allSearch);
    });
    loadcount = 0;
    if(!allSearch.hasClass("references"))
      scrollToTop();
    return false;
  }

  function scrollToTop(){
    try{
      $jq(window).scrollTop(0);
    }catch(err){
    }
    Scrolling.resetSidebar();
    return undefined;
  }

  function allResults(type, species, query, widget){
    var url = "/search/" + type + "/" + query + "/1?inline=1" + (species && "&species=" + species),
        allSearch = $jq("#all-search-results"),
        searchSummary = $jq("#search-count-summary"),
        curr = $jq("#curr-ref-text");
    if(!widget){
      Scrolling.sidebarInit();
      search_change(type);
      ajaxGet(allSearch, url, undefined, function(){
        checkSearch(allSearch);

        var dl = searchSummary.find(".dl-search");
        dl.load(dl.attr("href"), function(){
          if((parseInt(dl.text().replace(/K/g,'000').replace(/[MBGTP]/g, '000000').replace(/\D/g, ''), 10)) < 100000){
            searchSummary.find("#get-breakdown").show().click(function(){
              setLoading($jq(this));
              searchFilter(searchSummary, curr);
              searchSummary.find(".ui-icon-close").click(function(){
                loadResults(url);
                searchSummary.find(".ui-selected").removeClass("ui-selected");
                return false;
              });
             });
          }
        });
      });
    } else if (widget == 'references') {
        // give users the option to filter results by paper type
        searchFilter(searchSummary, curr);
    }

  }

  function searchFilter(searchSummary, curr){
      searchSummary.find(".count").each(function() {
        $jq(this).load($jq(this).attr("href"), function(){
          if($jq(this).text() === '0'){
            $jq(this).parent().remove();
          }else {
            $jq(this).parent().show().parent().prev(".title").show();
            searchSummary.find("#get-breakdown").remove();
          }
        });
      });

      searchSummary.find(".load-results").click(function(){
        var button = $jq(this);
        loadResults(button.attr("href"));
        searchSummary.find(".ui-selected:not('#current-ref')").removeClass("ui-selected");
        button.addClass("ui-selected");
        curr.html(button.html());
        return false;
      });
  }


  function recordOutboundLink(link, category, action) {
    try {
      var pageTracker=_gat._createTracker("UA-16257183-1");
      pageTracker._trackEvent(category, action);
    }catch(err){}
  }


    function openWidget(widget_name, nav, content, column){
        var url     = nav.attr("href");

        content.closest("li").appendTo($jq("#widget-holder").children(column));

        if(content.text().length < 4){
          addWidgetEffects(content.parent(".widget-container"));
          ajaxGet(content, url, undefined, function(){
            Scrolling.sidebarMove();checkSearch(content);
            Layout.resize();
          });
        }
        moduleMin(content.prev().find(".module-min"), false, "maximize");
        nav.addClass("ui-selected");
        content.parents("li").addClass("visible");
        return false;
    }

    function minWidget(widget_name){
      moduleMin($jq("#" + widget_name).find(".module-min"), false, "minimize");
    }

    function reloadWidget(widget_name, noLoad, url){
        var con = $jq("#" + widget_name + "-content");
        if(con.text().length > 4)
          ajaxGet(con, url || $jq("#nav-" + widget_name).attr("href"), noLoad, function(){ checkSearch(con); });
    }


  function addWidgetEffects(widget_container) {
      widget_container.find("div.module-min").hover(
        function () {
          var button = $jq(this);
          button.addClass((button.hasClass("show") ? "ui-icon-circle-triangle-e" : "ui-icon-circle-triangle-s"));
        },
        function () {
          var button = $jq(this);
          button.removeClass("ui-icon-circle-triangle-s ui-icon-circle-triangle-e").addClass((button.hasClass("show") ? "ui-icon-triangle-1-e" : "ui-icon-triangle-1-s"));
        }
      );

      widget_container.find("div.module-close").hover(
        function () {
          $jq(this).toggleClass("ui-icon-circle-close ui-icon-close");
        }
      );
  }


var Layout = (function(){
  var sColumns = false,
      ref = $jq("#references-content"),
      wHolder = $jq("#widget-holder"),
      title = $jq("#page-title").find("h2"),
      maxWidth = (location.pathname === '/' || location.pathname === '/me') ? 900 : 1300; //home page? allow narrower columns
    //get an ordered list of all the widgets as they appear in the sidebar.
    //only generate once, save for future
      widgetList = this.wl || (function() {
        var instance = this,
            navigation = $jq("#navigation"),
            list = navigation.find(".module-load")
                  .map(function() { return this.getAttribute("wname");})
                  .get();
        this.wl = { list: list };
        return this.wl;
        })();

    function resize(){
      if(sColumns !== (sColumns = (document.documentElement.clientWidth < maxWidth))){
        sColumns ? columns(100, 100) : readHash();
        if(multCol = $jq("#column-dropdown").find(".multCol")) multCol.toggleClass("ui-state-disabled");
      }
      if ((body.hasClass('table-columns')) && title.size() > 0 &&
        ((wHolder.children(".left").width() + wHolder.children(".right").width()) >
        (title.outerWidth())))
        columns(100, 100, 1);
      if(ref && (ref.hasClass("widget-narrow") !== (ref.innerWidth() < 845)))
        ref.toggleClass("widget-narrow");
    }

    function columns(leftWidth, rightWidth, noUpdate){
      var sortable = wHolder.children(".sortable"),
          tWidth = wHolder.innerWidth(),
          leftWidth = sColumns ? 100 : leftWidth;
      if(leftWidth>95){
        rightWidth = leftWidth = 100;
        body.removeClass('table-columns').addClass('one-column');
      }else{
        body.addClass('table-columns').removeClass('one-column');
      }
      sortable.filter(".left").css("width",leftWidth + "%");
      sortable.filter(".right").css("width",rightWidth + "%");

      if(!noUpdate){ updateLayout(); }
    }

    function deleteLayout(layout){
      var $class = wHolder.attr("wclass");
      $jq.get("/rest/layout/" + $class + "/" + layout + "?delete=1");
      $jq("div.columns ul div li#layout-" + layout).remove();
    }

    function setLayout(layout){
      var $class = wHolder.attr("wclass");
      $jq.get("/rest/layout/" + $class + "/" + layout, function(data) {
          var nodeList = data.childNodes[0].childNodes,
              len = nodeList.length;
          for(i=0; i<len; i++){
            var node = nodeList.item(i);
            if(node.nodeName === "data"){
              location.hash = node.attributes.getNamedItem('lstring').nodeValue;
            }
          }
        }, "xml");
    }

    function resetPageLayout(layout){
      layout = layout || wHolder.data("layout");
      if(layout['hash']){
          location.hash = layout['hash'];
      }else{
          resetLayout(layout['leftlist'], layout['rightlist'] || [], layout['leftwidth'] || 100);
          reloadLayout++;
          updateLayout();
      }
    }


    function newLayout(layout){
      updateLayout(layout, undefined, function() {
        $jq(".list-layouts").load("/rest/layout_list/" + $jq(".list-layouts").data("class") + "?section=" + $jq(".list-layouts").data("section"), function(response, status, xhr) {
            if (status === "error") {
                var msg = "Sorry but there was an error: ";
                $jq(".list-layouts").html(ajaxError(xhr));
              }
            });
          });
      if(timer){
        clearTimeout(timer);
        timer = undefined;
      }
      timer = setTimeout(function() {
          $jq("#column-dropdown").children("ul").hide();
       }, 700)
      return false;
    }

    function updateURLHash (left, right, leftWidth, minimized, sidebar) {
      var l = $jq.map(left, function(i) { return getWidgetID(i);}),
          r = $jq.map(right, function(i) { return getWidgetID(i);}),
          m = $jq.map(minimized, function(i) { return getWidgetID(i);}),
          ret = l.join('') + "-" + r.join('') + "-" + (leftWidth/10) + (m.length > 0 ? "-" + m.join('') : "") + (sidebar ? "-" : "");
      if(location.hash && decodeURI(location.hash).match(/^[#](.*)$/)[1] !== ret){
        reloadLayout++;
      }
      location.hash = ret;
      return ret;
    }

    function readHash() {
      if(reloadLayout === 0){
        var hash = location.hash,
            arr,
            h = (arr = decodeURI(hash).match(/^[#](.*)$/)) ? arr[1].split('-') : undefined;
        if(!h){ return; }

        var l = h[0],
            r = h[1],
            w = (h[2] * 10),
            m = h[3],
            s = (hash.charAt(hash.length-1) === '-');

        if(l){ l = $jq.map(l.split(''), function(i) { return getWidgetName(i);}); }
        if(r){ r = $jq.map(r.split(''), function(i) { return getWidgetName(i);}); }
        if(m){ m = $jq.map(m.split(''), function(i) { return getWidgetName(i);}); }
        resetLayout(l,r,w,hash,m,s);
      }else{
        reloadLayout--;
      }
    }



    //returns order of widget in widget list in radix (base 36) 0-9a-z
    function getWidgetID (widget_name) {
        return widgetList.list.indexOf(widget_name).toString(36);
    }

    function openAllWidgets(){
      var hash = "",
          wlen = $jq("#navigation").find("li.module-load:not(.tools,.me,.toggle)").size();
      if(widgetList.list.length === 0){ return; }
      for(i=0; i<wlen; i++){
        hash = hash + (i.toString(36));
      }
      window.location.hash = hash + "--10";
      return false;
    }

    //returns widget name
    function getWidgetName (widget_id) {
        return widgetList.list[parseInt(widget_id,36)];
    }

    function updateLayout(layout, hash, callback){
      var $class = wHolder.attr("wclass"),
          lstring = hash || readLayout(wHolder),
          l = ((typeof layout) === 'string') ? escape(layout) : 'default';
      $jq.post("/rest/layout/" + $class + "/" + l, { 'lstring':lstring }, function(){
      Layout.resize();
      if(callback){ callback(); }
      });
    }

    function readLayout(holder){
      var left = holder.children(".left").children(".visible")
                      .map(function() { return this.id;})
                      .get(),
          right = holder.children(".right").children(".visible")
                      .map(function() { return this.id;})
                      .get(),
          leftWidth = getLeftWidth(holder),
          minimized = holder.find(".visible .widget-container.minimized").parent()
                                .map(function() { return this.id;})
                      .get(),
          sidebar = $jq("#navigation").find(".closed").size() > 0 ? true : false;
      return updateURLHash(left, right, leftWidth, minimized, sidebar);
    }

    function getLeftWidth(holder){
      var leftWidth = sColumns ?  ((decodeURI(location.hash).match(/^[#](.*)$/)[1].split('-')[2]) * 10): (parseFloat(holder.children(".left").outerWidth())/(parseFloat(holder.outerWidth())))*100;
      return Math.round((isNaN(leftWidth) ? 100 : leftWidth)/10) * 10; //if you don't round, the slightest change causes an update
    }

    function resetLayout(leftList, rightList, leftWidth, hash, minimized, sidebar){
      $jq("#navigation").find(".ui-selected").removeClass("ui-selected");
      $jq("#widget-holder").children().children("li").removeClass("visible");

      columns(leftWidth, (100-leftWidth), 1);
      for(var widget = 0, l = leftList ? leftList.length : 0; widget < l; widget++){
        var widget_name = $jq.trim(leftList[widget]);
        if(widget_name.length > 0){
          var nav = $jq("#nav-" + widget_name),
              content = $jq("#" + widget_name + "-content");
          openWidget(widget_name, nav, content, ".left");
        }
      }
      for(var widget = 0, l = rightList ? rightList.length : 0; widget < l; widget++){
        var widget_name = $jq.trim(rightList[widget]);
        if(widget_name.length > 0){
          var nav = $jq("#nav-" + widget_name),
              content = $jq("#" + widget_name + "-content");
          openWidget(widget_name, nav, content, ".right");
        }
      }
      for(var widget = 0, l = minimized ? minimized.length : 0; widget < l; widget++){
        var widget_name = $jq.trim(minimized[widget]);
        if(widget_name.length > 0){
          minWidget(widget_name);
        }
      }
      if(sidebar){
        $jq("#nav-min").click();
      }
      if(location.hash.length > 0){
        updateLayout(undefined, hash);
      }
    }




  var Breadcrumbs = (function(){
    var bc = $jq("#breadcrumbs"),
        bExp = false,
        hiddenContainer,
        bWidth,
        bCount;

    function init() {
      if (!bc || ((bCount = bc.children().size()) < 3)) { return; }
      var children = bc.children(),
          hidden = children.slice(0, (bCount - 2)),
          shown = children.slice((bCount - 2)),
          expand;
      bc.empty();
      hiddenContainer = $jq('<span id="breadcrumbs-hide"></span>');
      hiddenContainer.append(hidden).children().after(' &raquo; ');

      bc.append('<span id="breadcrumbs-expand" class="ui-icon-large ui-icon-triangle-1-e tl" tip="exapand"></span>').append(hiddenContainer).append(shown);
      bc.children(':last').addClass("page-title").before(" &raquo; ");

      expand = $jq("#breadcrumbs-expand");
      expand.click( function(){
        (bExp = !bExp) ? show($jq(this)) : hide($jq(this));
      });
      bWidth = hiddenContainer.width();
      hide(expand);
    }

    function show(expand){
      hiddenContainer.animate({width:bWidth}, function(){ hiddenContainer.css("width", "auto");}).css("visibility", 'visible');
      expand.attr("tip", "minimize").removeClass("ui-icon-triangle-1-e").addClass("ui-icon-triangle-1-w");
    }

    function hide(expand){
      hiddenContainer.animate({width:0}, function(){ hiddenContainer.css("visibility", 'hidden');});
      expand.attr("tip", "expand").removeClass("ui-icon-triangle-1-w").addClass("ui-icon-triangle-1-e");
    }

    return {
     init: init
    }
  })();

  return {
      resize: resize,
      deleteLayout: deleteLayout,
      columns: columns,
      openAllWidgets: openAllWidgets,
      resetLayout: resetLayout,
      setLayout: setLayout,
      resetPageLayout: resetPageLayout,
      readHash: readHash,
      getLeftWidth: getLeftWidth,
      updateLayout: updateLayout,
      Breadcrumbs: Breadcrumbs,
      newLayout: newLayout
  }
})();



var Scrolling = (function(){
  var $window = $jq(window),
      system_message = 0,
      static = 0,// 1 = sidebar fixed position top of page. 0 = sidebar in standard pos
      footerHeight = $jq("#footer").outerHeight(),
      sidebar,
      offset,
      widgetHolder,
      body = $jq('html,body'),
      scrollingDown = 0,
      count = 0, //semaphore
      titles;

  function resetSidebar(){
    static = 0;
    sidebar.stop(false, true).css('position', 'relative').css('top', 0);
  }

  function goToAnchor(anchor){
      var elem = document.getElementById(anchor),
          scroll = isScrolledIntoView(elem) ? undefined : $jq(elem).offset().top - system_message - 10;
      if(scroll){
        body.stop(false, true).animate({
          scrollTop: scroll
        }, 2000, function(){ Scrolling.sidebarMove(); scrollingDown = 0;});
        scrollingDown = (body.scrollTop() < scroll) ? 1 : 0;
      }
  }

  function scrollUp(elem){
    var elemBottom = $jq(elem).offset().top + $jq(elem).height(),
        docViewBottom = $window.scrollTop() + $window.height();
    if((elemBottom <= docViewBottom) ){
      body.stop(false, true).animate({
          scrollTop: $window.scrollTop() - elem.height() - 10
      }, "fast", function(){ Scrolling.sidebarMove(); });
    }
  }

  function isScrolledIntoView(elem){
      var docViewTop = $window.scrollTop(),
          docViewBottom = docViewTop + ($window.height()*0.75),
          elemTop = $jq(elem).offset().top;
      return ((docViewTop <= elemTop) && (elemTop <= docViewBottom));
  }

  function sidebarMove() {
      if(!sidebar)
        return;
      if(sidebar.offset()){
        var objSmallerThanWindow = (sidebar.outerHeight() < ($window.height() - system_message)) || (sidebar.find(".closed").size() > 0),
            scrollTop = $window.scrollTop(),
            maxScroll = $jq(document).height() - (sidebar.outerHeight() + footerHeight + system_message + 20); //the 20 is for padding before footer

        if(sidebar.outerHeight() > widgetHolder.height()){
            resetSidebar();
            return;
        }
        if (objSmallerThanWindow){
          if(static===0){
            if ((scrollTop >= offset) && (scrollTop <= maxScroll)){
                sidebar.stop(false, true).css('position', 'fixed').css('top', system_message);
                static = 1;
            }else if(scrollTop > maxScroll){
                sidebar.stop(false, true).css('position', 'fixed').css('top', system_message - (scrollTop - maxScroll));
            }else{
                resetSidebar();
            }
          }else{
            if (scrollTop < offset) {
                resetSidebar();
            }else if(scrollTop > maxScroll){
                sidebar.stop(false, true).css('position', 'fixed').css('top', system_message - (scrollTop - maxScroll));
                static = 0;
                if(scrollingDown === 1){body.stop(false, true); scrollingDown = 0; }
            }
          }
        }else if(count===0 && (titles = sidebar.find(".ui-icon-triangle-1-s:not(.pcontent)"))){
          count++; //Add counting semaphore to lock
          //close lowest section. delay for animation.
          titles.last().parent().click().delay(250).queue(function(){ count--; Scrolling.sidebarMove();});
        }else{
          resetSidebar();
        }
      }
    }

  function sidebarInit(){
    sidebar   = $jq("#navigation");
    offset = sidebar.offset().top;
    widgetHolder = $jq("#widget-holder");

    $window.scroll(function() {
      Scrolling.sidebarMove();
    });
  }

  var search = function searchInit(){
      if(loadcount >= 6){ return; }
      $window.scroll(function() {
        var results    = $jq("#results");
        if(results.offset() && loadcount < 6){
          var rHeight = results.height() + results.offset().top;
          var rBottomPos = rHeight - ($window.height() + $window.scrollTop())
          if(rBottomPos < 400) {
            results.children(".load-results").trigger('click');
          }
        }
      });
    };

  function set_system_message(val){
    system_message = val;
  }

  return {
    sidebarInit:sidebarInit,
    search:search,
    set_system_message:set_system_message,
    sidebarMove: sidebarMove,
    resetSidebar:resetSidebar,
    goToAnchor: goToAnchor,
    scrollUp: scrollUp
  }
})();

    if(!Array.indexOf){
        Array.prototype.indexOf = function(obj){
            for(var i=0; i<this.length; i++){
                if(this[i]===obj){
                    return i;
                }
            }
            return -1;
        }
    }


  function updateCounts(url){
    var comments = $jq(".comment-count");
    if(comments.size() > 0)
      comments.load("/rest/feed/comment?count=1;url=" + url);
  }


  function validate_fields(email,username, password, confirm_password, wbemail){
      if( (email.val() ==="") && (!wbemail || wbemail.val() === "")){
                email.focus().addClass("ui-state-error");
                email.closest('#issues-new').find(".anon").removeClass("anon");
                return false;
      } else if( email.val() && (validate_email(email.val(),"Not a valid email address!")===false)) {
                email.focus().addClass("ui-state-error");
                email.closest('#issues-new').find(".anon").removeClass("anon");
                return false;
      } else if(password) {
          if( password.val() ===""){
                password.focus().addClass("ui-state-error");return false;
          } else if( confirm_password && (password.val() !== confirm_password.val())) {
              alert("The passwords do not match. Please enter again"); password.focus().addClass("ui-state-error");return false;
          }
      } else if( username && username.val() ==="") {
                username.focus().addClass("ui-state-error"); return false;
      }  else {
        return true;
      }
  }

  function validate_email(field,alerttxt){
    var apos=field.indexOf("@"),
        dotpos=field.lastIndexOf(".");
    if (apos<1||dotpos-apos<2)
      {alert(alerttxt);return false;}
    else {return true;}
  }


  var comment = {
    init: function(pageInfo){
      comment.url = pageInfo['ref'];
    },
    submit: function(cm){
        var feed = cm.closest('#comment-new'),
            content = feed.find(".comment-content").val();
        if(content === "" || content === "write a comment..."){
            alert("Please provide your name & comment"); return false;
        }
        $jq.ajax({
          type: 'POST',
          url: '/rest/feed/comment',
          data: { content: content, url: comment.url},
          success: function(data){
            displayNotification("Comment Submitted!");
            feed.find("#comment-box").prepend(data);
            feed.find(".comment-content").val("write a comment...");
            updateCounts(url);
              },
          error: function(xhr,status,error) {
                $jq("#comments").prepend(ajaxError(xhr));
              }
        });
        var box = $jq('<div class="comment-box"><a href="/me">' + name + '</a> ' + content + '<br /><span id="fade">just now</span></div>');
        var comments = $jq("#comments");
        comments.prepend(box);
        return false;
    },
    cmDelete: function(cm){
       var $id=cm.attr("id"),
           url= cm.attr("rel");

      $jq.ajax({
        type: "POST",
        url : url,
        data: {method:"delete",id:$id},
        success: function(data){
                      updateCounts(url);
          },
        error: function(xhr,status,error) {
                $jq("#comments").prepend(ajaxError(xhr));
            cm.innerHTML(error);
          }
      });
      cm.parent().remove();
    }

  }


  var issue = {
    init: function(pageInfo){
      issue.url = pageInfo['ref'];
    },
   submit:function(is){
        var rel= is.attr("rel"),
            url = is.attr("url"),
            page = is.attr("page"),
            feed = is.closest('#issues-new'),
            name = feed.find("#name"),
            dc = feed.find("#desc-content"),
            email = feed.find("#email"),
            anon = feed.find("#anon").is(':checked'),
            content = feed.find("#issue-content").val() + (dc.length > 0 ? '<br />What were you doing?: <br />&nbsp;&nbsp;' + dc.val() : '');
        if (!anon && !validate_fields(email, name))
          return;
        if(!content){
          feed.find("#issue-content").focus();
          return;
        }

        $jq.ajax({
          type: 'POST',
          url: rel,
          dataType: 'json',
          data: {title:feed.find("#issue-title option:selected").val(),
                content: content,
                name: name.val(),
                email: email.val(),
                url: url || issue.url,
                page: page,
                hash: location.hash,
                userAgent: window.navigator.userAgent},
          success: function(data){
                  feed.append(data.message);
              },
          error: function(xhr,status,error) {
                  feed.append(ajaxError(xhr));
              }
        });
        feed.children().remove();
        feed.append("<p><h2>Thank you for helping WormBase!</h2></p><p>The WormBase helpdesk will get back to you shortly. You will recieve an email confirmation momentarily. Please email <a href='mailto:help\@wormbase.org'>help\@wormbase.org</a> if you have any concerns.</p>")
        return false;
   }
  }


  var StaticWidgets = {
    update: function(widget_id, path){
        if(!widget_id){ widget_id = "0"; }
        var widget = $jq("li#static-widget-" + widget_id),
            widget_title = widget.find("input#widget_title").val(),
            widget_order = widget.find("input#widget-order").val(),
            widget_content = widget.find("textarea#widget_content").val();

        $jq.ajax({
              type: "POST",
              url: "/rest/widget/static/" + widget_id,
              dataType: 'json',
              data: {widget_title:widget_title, path:path, widget_content:widget_content, widget_order:widget_order},
              success: function(data){
                    StaticWidgets.reload(widget_id, 0, data.widget_id);
                },
              error: function(xhr,status,error) {
                widget.find(".content").html(ajaxError(xhr));
                }
          });
    },
    edit: function(wname, rev) {
      var widget_id = wname.split("-").pop(),
          w_content = $jq("#" + wname + "-content"),
          widget = w_content.parent(),
          edit_button = widget.find("a#edit-button");
      if(edit_button.hasClass("ui-state-highlight")){
        StaticWidgets.reload(widget_id);
      }else{
        edit_button.addClass("ui-state-highlight");
        w_content.load("/rest/widget/static/" + widget_id + "?edit=1");
      }

    },
    reload: function(widget_id, rev_id, content_id){
      var w_content = $jq("#static-widget-" + widget_id + "-content"),
          widget = w_content.parent(),
          title = widget.find("h3 span.widget-title input"),
          url = "/rest/widget/static/" + (content_id || widget_id);
      if(title.size()>0){
        title.parent().html(title.val());
      }
      widget.find("a.button").removeClass("ui-state-highlight");
      $jq("#nav-static-widget-" + widget_id).text(title.val());
      if(rev_id) { url = url + "?rev=" + rev_id; }
      w_content.load(url);
    },
    delete_widget: function(widget_id){
      if(confirm("are you sure you want to delete this widget?")){
        $jq.ajax({
          type: "POST",
          url: "/rest/widget/static/" + widget_id + "?delete=1",
          success: function(data){
            $jq("#nav-static-widget-" + widget_id).click().hide();
          },
          error: function(xhr,status,error) {
              $jq("li#static-widget-" + widget_id).find(".content").html(ajaxError(xhr));
          }
        });
      }
    },
    history: function(wname){
      var widget = $jq("#" + wname),
         history = widget.find("div#" + wname + "-history");
      if(history.size() > 0){
        history.toggle();
        widget.find("a#history-button").toggleClass("ui-state-highlight");
      }else{
        var widget_id = wname.split("-").pop(),
            history = $jq('<div id="' + wname + '-history"></div>');
        history.load("/rest/widget/static/" + widget_id + "?history=1");
        widget.find("div.content").append(history);
        widget.find("a#history-button").addClass("ui-state-highlight");
      }
    }
  }


  function historyOn(action, value, callback){
    if(action === 'get'){
        Plugin.getPlugin("colorbox", function(){
            $jq(".history-logging").colorbox();
            if(callback) callback();
        });
    }else{
      $jq.post("/rest/history", { 'history_on': value }, function(){
        histUpdate(value == 1 ? 1 : undefined);
        if(callback) callback(); });
      if($jq.colorbox) $jq.colorbox.close();
      $jq(".user-history").add("#user_history-content").html("<div><span id='fade'>Please wait, updating your history preferences</span></div>");
    }
  }

  function loadRSS(id, url){
    var container = $jq("#" + id);
    setLoading(container);
    Plugin.getPlugin("jGFeed", function(){
      $jq.jGFeed(url,
        function(feeds){
          // Check for errors
          if(!feeds){
            // there was an error
            return false;
          }
          var txt = '<div id="results"><ul>';
          for(var i=-1, entry; (entry = feeds.entries[++i]);){
            txt += '<div class="result"><li><div class="date" id="fade">'
                + entry.publishedDate.substring(0, 16) + '</div>'
                + '<a href="' + entry.link + '">' + entry.title + '</a></li>'
                + '<div class="text-min">' + entry.content.replace(/(\<\/?p\>|\<br\>)/g, '') + '</div></div>';
          }
          txt += '</ul></div>';
          container.html(txt);
          formatExpand(container);
        }, 3);
    });
  }




  var providers_large = {
      google: {
          name: 'Google',
          url: 'https://www.google.com/accounts/o8/id'
      },
      facebook: {
          name: 'Facebook',
          url:  'http://facebook.anyopenid.com/'
      }
  };

  var providers = $jq.extend({}, providers_large);

  var openid = {
      signin: function(box_id, onload) {
        var provider = providers[box_id];
        if (! provider) {
            return;
        }
        var pop_url = '/auth/popup?id='+box_id + '&url=' + provider['url']  + '&redirect=' + location;
        this.popupWin(pop_url);
      },

      popupWin: function(url) {
        // var h = 400;
        // var w = 600;
        // var screenx = (screen.width/2) - (w/2 );
        // var screeny = (screen.height/2) - (h/2);

        // var win2 = window.open(url,"popup","status=no,resizable=yes,height="+h+",width="+w+",left=" + screenx + ",top=" + screeny + ",toolbar=no,menubar=no,scrollbars=no,location=no,directories=no");
        // win2.focus();
        window.location = url;
      }
  };


	function setupCytoscape(data, types, clazz){

        /* Converts element attributes to their appropriate mapped values
         * Any non-matching attributes will be matched to the "other" mapping
         *     if exists
            * data: data
            * elementType: nodes or edges
            * attr: some key under data[elementType][i].data
            * mapping: obj mapping oldVal: newVal for attr
            * (toType): new values will be put into this attr, if attr
            *   shouldn't be touched
        */
        function mapAttr(elementType, attr, mapping, toType){
            for(var i=0; i < data[elementType].length; i++){
                element = data[elementType][i]['data'][attr];
                toType = toType ? toType : attr;
                if( mapping[element] ){
                    data[elementType][i]['data'][toType] = mapping[element];
                }else if(mapping['other']){
                    data[elementType][i]['data'][toType] = mapping['other'];
                }
            }
        }

        // Execute custom mappers
        for(var i=0; i < data.mappers.length; i++){
            var m = data.mappers[i];
            mapAttr(m.elementType, m.attribute, m.mapping, m.toType);
        }

        // Color of each type, in order.  Matches legend.  See interaction_details.tt2
        var edgeColor = ["#0A6314", "#08298A","#B40431","#FF8000", "#00E300","#05C1F0", "#8000FF", "#69088A", "#B58904", "#E02D8A", "#FFFC2E" ];
        var typeColorMapper = function(){
            var map = {};
            for(var i=0; i < types.length; i++){
                // Predicted always black
                map[ types[i] ] =
                    (types[i] == 'Predicted') ? '#999' : edgeColor[i];
            }
            return map;
        }();
        //mapAttr('edges', 'type', typeColorMapper, 'color');

        +function increaseBaseWidth(baseWidth){
            for(var i=0; i < data['edges'].length; i++){
                data['edges'][i]['data']['width'] += baseWidth;
            }
        }(1);

        Plugin.getPlugin('cytoscape_js',function(){

            var legend = $jq('#cyto_legend');

            $jq( "#cy" ).cytoscape({

            style: cytoscape.stylesheet()
                .selector('node')
                .css({
                    'opacity': 0.7,
                    'border-width': 0,
                    'shape': 'data(shape)',
                    'content': 'data(name)',
                    'text-valign': 'center',
                    'color': 'black',
                    'text-outline-color': 'white',
                    'text-outline-width': 2
                })
                .selector('edge')
                .css({
                    'width': 'data(width)',
                    'opacity':0.4,
                    'line-color': 'data(color)',
                    'line-style': 'solid'

                })
                .selector('edge[type="Predicted"]')
                .css({
                    'line-style': 'dotted'
                })
                .selector('edge[direction="Effector->Affected"]')
                .css({
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': 'data(color)',
                    'source-arrow-color': 'data(color)'
                })
                .selector('node[mainNode]')
                .css({
                    'height': '40px',
                    'width': '40px',
                    'background-color': 'red'
                })
                .selector(':selected')
                .css({
                    'opacity': 1,
                    'border-color': 'black',
                    'border-width': 2,
                }),

            elements: data,

            layout: {
                name: 'arbor',
            },

            ready: function(){
                window.cy = this;

                resetChecked();
                updateEdgeFilter();
                updateNodeFilter();

                legend.find('input:checkbox').click(function(){
                    if(this.name == 'interactionToggle'){
                        if(this.checked){
                            legend.find('input:checkbox[name="type"]').prop('checked',true);
                        }else{
                            legend.find('input:checkbox[name="type"]').prop('checked',false);
                        }
                    }
                    if(this.name == 'phenotypeToggle'){
                        if(this.checked){
                            legend.find('input:checkbox[name="phenotype"]').prop('checked',true);
                        }else{
                            legend.find('input:checkbox[name="phenotype"]').prop('checked',false);
                        }
                    }

                    updateEdgeFilter();
                    updateNodeFilter();
                });

                cy.on('tap', 'node', function(e){
                    window.open(e.cyTarget.data().link); });

            }

            });

            function resetChecked(){
                legend.find('input:checkbox').map(function(){
                    var t = $jq(this);
                    if (t.attr('name') == 'type'){
                        t.prop('checked', (clazz === 'Predicted' ? true : (!t.val().match('Predicted'))));
                    }else if(!(clazz === 'WBProcess' && t.val().match('nearby'))){
                        // don't check nearby if process page
                        t.prop('checked', true);
                    }
                });

            }

            // Hide all edges, show a subset, then hide all visible members of
            // each non-asserted subset thereafter
            function updateEdgeFilter(){
                /* for all elements:
                 * make true those which
                 *  edge "type" value match the values of "type" checkboxes
                 *  edge "direction" value match the values of "direction" checkboxes
                 *
                 * NOTE: Can use cy.filter( function(i, ele) ) instead
                 */

                cy.elements('edge').hide();

                // Get arrays of valid edge types
                var edgeTypes = legend.find('input[name="type"]:checked')
                    .map(function(){ return this.getAttribute('value'); }).get()
                var edgeDirs = legend.find('input[name="direction"]:checked')
                    .map(function(){ return this.getAttribute('value'); }).get();
                var edgePhens = legend.find('input[name="phenotype"]:checked')
                    .map(function(){ return this.getAttribute('value'); }).get();

                var nearbyExists = legend.find('input[name=nearby]').size() > 0 ?
                    true : false;
                var nearbyChecked =
                    legend.find('input[name=nearby]:checked').size() > 0 ?
                    true : false;

                // restore checked edge types
                cy.elements('edge').filter(function(i, ele){
                    /**console.log({
                        inEdgePhens: $jq.inArray(ele.data().phenotype, edgePhens),
                        inEdgeTypes: $jq.inArray(ele.data().type,      edgeTypes),
                        inEdgeDirs:  $jq.inArray(ele.data().direction, edgeDirs )
                    });**/
                    if(
                        (!ele.data().phenotype || $jq.inArray(ele.data().phenotype, edgePhens) > -1) &&
                        (!ele.data().type      || $jq.inArray(ele.data().type,      edgeTypes) > -1) &&
                        (!ele.data().direction || $jq.inArray(ele.data().direction, edgeDirs ) > -1) &&
                        (
                            !nearbyExists || // is nearby asserted?
                            ele.data().nearby == 0 || // non-nearby edges will show regardless
                            (nearbyChecked && ele.data().nearby == 1)
                        )
                    ){
                        return true;
                    }else{
                        return false;
                    }
                }).show();
            }

            // Show all nodes then hide all non-connected
            function updateNodeFilter(){
                cy.elements('node').show();

                // Interactor types
                var intTypes = legend.find('input[name=nodes]:not(:checked)')
                    .map(function(){ return this.getAttribute('value'); }).get();

                for (var i=0; i < intTypes.length; i++){
                    var type = intTypes[i];
                    cy.elements('node[^mainNode][ntype = "'+ type +'"]').hide();
                }

                // Hide nodes with no visible edges
                cy.elements('node[^mainNode]').filter(function(i, ele){
                    return ele.edgesWith('').allAre(':hidden');
                }).hide();

            }

        });


	}

	function getMarkItUp(callback){
      Plugin.getPlugin("markitup", function(){
        Plugin.getPlugin("markitup-wiki", callback);
      });
      return;
    }

    var Plugin = (function(){
      var plugins = new Array(),
          css = new Array(),
          loading = false,
          pScripts = {  highlight: "/js/jquery/plugins/jquery.highlight-1.1.js",
                        dataTables: "/js/jquery/plugins/dataTables/media/js/jquery.dataTables.min.js",
                        colorbox: "/js/jquery/plugins/colorbox/colorbox/jquery.colorbox-min.js",
                        jGFeed:"/js/jquery/plugins/jGFeed/jquery.jgfeed-min.js",
                        generateFile: "/js/jquery/plugins/generateFile.js",
                        pfam: "/js/pfam/domain_graphics.min.js",
                        markitup: "/js/jquery/plugins/markitup/jquery.markitup.js",
                        "markitup-wiki": "/js/jquery/plugins/markitup/sets/wiki/set.js",
                        tabletools: "/js/jquery/plugins/tabletools/media/js/TableTools.min.js",
                        placeholder: "/js/jquery/plugins/jquery.placeholder.min.js",
                        cytoscape_js: "/js/jquery/plugins/cytoscapejs/cytoscape.min.js"
          },
          pStyle = {    dataTables: "/js/jquery/plugins/dataTables/media/css/demo_table.css",
                        colorbox: "/js/jquery/plugins/colorbox/colorbox/colorbox.css",
                        markitup: "/js/jquery/plugins/markitup/skins/markitup/style.css",
                        "markitup-wiki": "/js/jquery/plugins/markitup/sets/wiki/style.css",
                        tabletools: "/js/jquery/plugins/tabletools/media/css/TableTools.css"
          };




      function getScript(name, url, stylesheet, callback) {

       function LoadJs(){
           css[name] = true;
           loadFile(url, true, function(){
              callback();
              plugins[name] = true;
           });
        }

        if(stylesheet){
         loadFile(stylesheet, false, LoadJs());
        }else{
           LoadJs();
        }
      }


      function loadFile(url, js, callback) {
        var head = document.documentElement,
            script = document.createElement( js ? "script" : "link"),
            done = false;
        loading = true;

        if(js){
          script.src = url;
        }else{
          script.href = url;
          script.rel="stylesheet";
          script.type = "text/css";
        }

        function doneLoad(){
            done = true;
            loading = false;
            if(callback)
              callback();
        }

        if(js){
          script.onload = script.onreadystatechange = function() {
          if(!done && (!this.readyState ||
            this.readyState === "loaded" || this.readyState === "complete")){
            doneLoad();

              script.onload = script.onreadystatechange = null;
              if( head && script.parentNode){
                head.removeChild( script );
              }
            }
          };


        }else{
          script.onload = function () {
            doneLoad();
          }
          // #2
          if (script.addEventListener) {
            script.addEventListener('load', function() {
            doneLoad();
            }, false);
          }
          // #3
          script.onreadystatechange = function() {
            var state = script.readyState;
            if (state === 'loaded' || state === 'complete') {
              script.onreadystatechange = null;
            doneLoad();
            }
          };

          // #4
          var cssnum = document.styleSheets.length;
          var ti = setInterval(function() {
            if (document.styleSheets.length > cssnum) {
              // needs more work when you load a bunch of CSS files quickly
              // e.g. loop from cssnum to the new length, looking
              // for the document.styleSheets[n].href === url
              // ...

              // FF changes the length prematurely  )
            doneLoad();
              clearInterval(ti);

            }
          }, 10);
        }

        head.insertBefore( script, head.firstChild);
        return undefined;
      }


      function getPlugin(name, callback){
        var script = pScripts[name],
            css = pStyle[name];
        loadPlugin(name, script, css, callback);
        return;
      }

      function loadPlugin(name, url, stylesheet, callback){
        if(!plugins[name]){
          getScript(name, url, !css[name] ? stylesheet : undefined, callback);
        }else{
          if(loading){
            return setTimeout(getPlugin(name, url, stylesheet, callback),10);
          }else{
            callback();
          }
        }
        return;
      }

      return {
        getPlugin: getPlugin,
        loadFile: loadFile
      };
    })();

    return{
      // initiate page
      init: init,                                   // initiate all js on any wormbase page

      // searching
      search: search,                               // run search using current filters
      search_change: search_change,                 // change the class search filter
      search_species_change: search_species_change, // change the species search filter
      checkSearch: checkSearch,                     // check search results - post-format if needed
      allResults: allResults,                       // setup search all page

      // static widgets
      getMarkItUp: getMarkItUp,                     // get markup plugin for static widgets
      StaticWidgets: StaticWidgets,                 // modify static widgets (edit/update)

      // layouts
      deleteLayout: Layout.deleteLayout,            // delete saved layout
      columns: Layout.columns,                      // get column configuration from layout
      setLayout: Layout.setLayout,                  // save current layout as a saved layout
      resetPageLayout: Layout.resetPageLayout,      // reset page to default widget layout
      resetLayout: Layout.resetLayout,              // apply page layout
      openAllWidgets: Layout.openAllWidgets,        // open all widgets on the page
      newLayout: Layout.newLayout,                  // create a new layout
      resize: Layout.resize,                        // resize the page

      // scrolling
      goToAnchor: Scrolling.goToAnchor,             // Scroll page to certain anchor
      scrollToTop: scrollToTop,                     // scroll to the top of the page

      // loading - ajax/plugins/files/RSS
      ajaxGet: ajaxGet,                             // load data via ajax request
      setLoading: setLoading,                       // add the loading image to a certain div
      loadRSS: loadRSS,                             // load RSS (homepage)
      loadFile: Plugin.loadFile,                    // load a file dynamically
      getPlugin: Plugin.getPlugin,                  // load plugin

      // notifications
      displayNotification: displayNotification,     // display notification at the top of the page

      // user session, comments/issues
      openid: openid,                               // login via openid
      historyOn: historyOn,                         // turn on history
      comment: comment,                             // add comment to a page
      issue: issue,                                 // submit an issue

      // miscellaneous
      validate_fields: validate_fields,             // validate form fields
      recordOutboundLink: recordOutboundLink,       // record external links
      setupCytoscape: setupCytoscape,               // setup cytoscape for use
      reloadWidget: reloadWidget                    // reload a widget
    }
  })();




  $jq(document).ready(function() {
      $jq.ajaxSetup( {timeout: 12e4 }); //2 minute timeout on ajax requests

      if(!window.$jq){
        WB.init();
        window.$jq = $jq;
      }
  });

  window.WB = WB;
}(this,document);



// Polyfills

if(typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  }
}

if(!Object.keys) Object.keys = function(o){
   if (o !== Object(o))
      throw new TypeError('Object.keys called on non-object');
   var ret=[],p;
   for(p in o) if(Object.prototype.hasOwnProperty.call(o,p)) ret.push(p);
   return ret;
}
