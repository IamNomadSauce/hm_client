package main

import (
	// "fmt"
	"html/template"
	"log"
	"math"
	"net/http"
)

func render(w http.ResponseWriter, r *http.Request, mainTemplate, title string, pageData map[string]any, extraTemplates ...string) {
	tmplFiles := append([]string{"base.html", mainTemplate}, extraTemplates...)
	funcMap := template.FuncMap{
		"multiply": func(a, b interface{}) float64 {
			var aFloat, bFloat float64

			switch v := a.(type) {
			case int:
				aFloat = float64(v)
			case float64:
				aFloat = v
			default:
				return 0
			}

			switch v := b.(type) {
			case int:
				bFloat = float64(v)
			case float64:
				bFloat = v
			default:
				return 0
			}

			return aFloat * bFloat
		},
		"divide": func(a, b interface{}) float64 {
			var aFloat, bFloat float64

			switch v := a.(type) {
			case int:
				aFloat = float64(v)
			case float64:
				aFloat = v
			default:
				return 0
			}

			switch v := b.(type) {
			case int:
				bFloat = float64(v)
			case float64:
				bFloat = v
			default:
				return 0
			}

			if bFloat == 0 {
				return 0
			}
			return aFloat / bFloat
		},
		"largeArcFlag": largeArcFlag,
		"add":          func(a, b float64) float64 { return a + b },
		"sub":          func(a, b float64) float64 { return a - b },
		"mul":          func(a, b float64) float64 { return a * b },
		"div":          func(a, b float64) float64 { return a / b },
		"cos":          math.Cos,
		"sin":          math.Sin,
		"degToRad":     func(deg float64) float64 { return deg * math.Pi / 180 },
		"gt": func(a, b interface{}) bool {
			switch a := a.(type) {
			case int:
				switch b := b.(type) {
				case int:
					return a > b
				case float64:
					return float64(a) > b
				}
			case float64:
				switch b := b.(type) {
				case int:
					return a > float64(b)
				case float64:
					return a > b
				}
			}
			return false // Default case if types are unsupported
		},
	}

	tmpl, err := template.New("").Funcs(funcMap).ParseFiles(tmplFiles...)
	if err != nil {
		log.Printf("Error parsing template files: %v", err)
		return
	}
	err = tmpl.ExecuteTemplate(w, "base", pageData)

}
