"use client"
import Link from "next/link";
import { redirect } from "next/navigation";

export default function Home() {
  return (
    <div className="grid grid-cols-3 flex flex-cols justify-start p-6">
      <div className="bg-panel border border-accent-copper rounded-md px-4 py-2">
        <h2 className="text-text-primary font-heading text-3xl p-4">Quiz</h2>
        <p className="text-text-body font-body px-4 py-2">Take the recommendation quiz to find out what computer best suits your needs!</p>
        <Link href="/questionnaire" className="border border-accent-teal text-accent-teal font-heading px-4 py-2 hover:bg-accent-teal hover:text-bg transition-colors">Questionnaire</Link>
      </div>
    </div>
  )
}